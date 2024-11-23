import { MessageSquare } from 'lucide-react';
import clsx from "clsx";

export function ChatIcon({ className, onClick }: { className?: string, onClick: () => void }) {
    return (
        <div className={clsx("bg-gray-500 rounded-full", className)} onClick={onClick}>
        <MessageSquare size={40}/>
        </div>
    );
}
