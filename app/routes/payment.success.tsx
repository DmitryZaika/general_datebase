import { LoaderFunctionArgs, redirect } from "react-router";
import { PageLayout } from "~/components/PageLayout";
import { Button } from "~/components/ui/button";
import { Link } from "react-router";
import { getSession, commitSession } from "~/sessions";
import { toastData } from "~/utils/toastHelpers";
import { getStripe } from "~/utils/getStripe";



export async function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("session_id");

    if (!sessionId) {
        return redirect("/");
    }

    try {
        const session = await getStripe().checkout.sessions.retrieve(sessionId);
        
        if (session.payment_status === "paid" && session.metadata?.saleId) {

            const flashSession = await getSession(request.headers.get("Cookie"));
            flashSession.flash("message", toastData("Success", "Payment successful!", "default"));
            
            return redirect("/", {
                headers: { "Set-Cookie": await commitSession(flashSession) }
            });
        }
    } catch (error) {
        console.error("Error processing payment success:", error);
    }

    return redirect("/");
}

export default function PaymentSuccess() {
    return (
        <PageLayout title="Payment Successful">
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <h1 className="text-3xl font-bold text-green-600 mb-4">Payment Successful!</h1>
                <p className="text-gray-600 mb-8">Thank you for your payment. Your transaction has been completed successfully.</p>
                <Link to="/">
                    <Button className="bg-blue-600 hover:bg-blue-700">
                        Return to Home
                    </Button>
                </Link>
            </div>
        </PageLayout>
    );
} 