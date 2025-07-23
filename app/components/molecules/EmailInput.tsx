import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { ControllerRenderProps } from "react-hook-form";
import { InputItem } from "~/components/molecules/InputItem";

interface EmailInputProps {
	field: ControllerRenderProps<any, any>;
	formClassName?: string;
	disabled?: boolean;
}

const emailDomains = [
	"@gmail.com",
	"@yahoo.com",
	"@outlook.com",
	"@hotmail.com",
	"@aol.com",
	"@icloud.com",
];

export const EmailInput: React.FC<EmailInputProps> = ({
	field,
	formClassName,
	disabled,
}) => {
	const [showSuggestions, setShowSuggestions] = useState(false);
	const [suggestions, setSuggestions] = useState<string[]>([]);
	const suggestionsRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		field.onChange(value);

		// Check if user typed @ and show domain suggestions
		if (value.includes("@") && !value.includes(".")) {
			const beforeAt = value.split("@")[0];
			const afterAt = value.split("@")[1] || "";

			if (beforeAt && afterAt.length === 0) {
				// Just typed @, show all suggestions
				setSuggestions(emailDomains.map((domain) => beforeAt + domain));
				setShowSuggestions(true);
			} else if (beforeAt && afterAt.length > 0) {
				// Typing after @, filter suggestions
				const filtered = emailDomains
					.filter((domain) =>
						domain.toLowerCase().startsWith(`@${afterAt.toLowerCase()}`),
					)
					.map((domain) => beforeAt + domain);
				setSuggestions(filtered);
				setShowSuggestions(filtered.length > 0);
			}
		} else {
			setShowSuggestions(false);
		}
	};

	const handleSuggestionClick = (suggestion: string) => {
		field.onChange(suggestion);
		setShowSuggestions(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Tab" && showSuggestions && suggestions.length > 0) {
			e.preventDefault();
			handleSuggestionClick(suggestions[0]);
		}
	};

	// Close suggestions when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				suggestionsRef.current &&
				!suggestionsRef.current.contains(event.target as Node)
			) {
				setShowSuggestions(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, []);

	return (
		<div className="relative">
			<InputItem
				name="Email"
				placeholder="Colin@gmail.com"
				field={{
					...field,
					onChange: handleChange,
					onKeyDown: handleKeyDown,
					disabled: disabled,
					ref: inputRef,
				}}
				formClassName={formClassName}
			/>

			{showSuggestions && suggestions.length > 0 && (
				<div
					ref={suggestionsRef}
					className="absolute z-10 w-full  max-h-32 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg"
				>
					<ul className="py-1 divide-y divide-gray-200">
						{suggestions.map((suggestion, index) => (
							<li
								key={index}
								className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
								onClick={() => handleSuggestionClick(suggestion)}
							>
								{suggestion}
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
};
