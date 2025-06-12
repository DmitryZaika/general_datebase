import { PageLayout } from "~/components/PageLayout";
import { Button } from "~/components/ui/button";
import { Link } from "react-router";

export default function PaymentCancelled() {
    return (
        <PageLayout title="Payment Cancelled">
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <h1 className="text-3xl font-bold text-red-600 mb-4">Payment Cancelled</h1>
                <p className="text-gray-600 mb-8">Your payment was cancelled. No charges were made.</p>
                <Link to="/">
                    <Button className="bg-blue-600 hover:bg-blue-700">
                        Return to Home
                    </Button>
                </Link>
            </div>
        </PageLayout>
    );
} 