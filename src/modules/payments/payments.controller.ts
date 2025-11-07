import { Request, Response } from 'express';
import Stripe from 'stripe';

import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { stripe } from '../../config/stripe';

export async function createCheckoutSession(req: Request, res: Response) {
  if (!stripe) return res.status(500).json({ message: 'Stripe is not configured' });
  const { orderId } = req.body as { orderId: string };
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } },
  });
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.userId !== req.user!.id && req.user!.role !== 'ADMIN')
    return res.status(403).json({ message: 'Forbidden' });
  if (order.status !== 'PENDING') return res.status(400).json({ message: 'Order not payable' });

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = order.items.map((it) => ({
    price_data: {
      currency: order.currency.toLowerCase(),
      unit_amount: it.unitPriceCents,
      product_data: { name: it.product.title },
    },
    quantity: it.quantity,
  }));

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      line_items: lineItems,
      success_url: `${env.CLIENT_URL || env.APP_URL}/checkout/success?orderId=${order.id}`,
      cancel_url: `${env.CLIENT_URL || env.APP_URL}/checkout/cancel?orderId=${order.id}`,
      metadata: { orderId: order.id },
    },
    { idempotencyKey: `order_${order.id}` },
  );

  res.json({ url: session.url });
}

export async function stripeWebhook(req: Request, res: Response) {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET)
    return res.status(500).json({ message: 'Stripe webhook not configured' });

  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).send('Missing signature');

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body as unknown as Buffer,
      sig as string,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(400).send(`Webhook Error: ${message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        try {
          await prisma.order.update({
            where: { id: orderId },
            data: { status: 'PAID', paymentIntentId: session.payment_intent as string },
          });
        } catch (error) {
          // Order might not exist (e.g., in tests), log but don't fail webhook
          console.error(`Failed to update order ${orderId}:`, error);
        }
      }
      break;
    }
    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent;
      const order = await prisma.order.findFirst({ where: { paymentIntentId: pi.id } });
      if (order) {
        await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
      }
      break;
    }
    default:
      break;
  }

  res.json({ received: true });
}
