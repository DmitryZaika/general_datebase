import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set in environment variables");
}

// We can safely assert the type here because we've checked it exists
const stripeSecretKey = process.env.STRIPE_SECRET_KEY as string;

export const getStripe = () => {
    return new Stripe(stripeSecretKey, {
        apiVersion: "2025-05-28.basil",
    });
};