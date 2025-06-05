import React from "react";
import { InputItem } from "~/components/molecules/InputItem";
import { ControllerRenderProps } from "react-hook-form";

interface PhoneInputProps {
  field: ControllerRenderProps<any, any>;
  formClassName?: string;
  disabled?: boolean;
}

const formatPhoneNumber = (value: string) => {
  // Убираем все символы кроме цифр
  const phoneNumber = value.replace(/[^\d]/g, "");

  // Ограничиваем до 10 цифр
  const truncated = phoneNumber.slice(0, 10);

  // Форматируем как 317-255-1414
  if (truncated.length >= 6) {
    return `${truncated.slice(0, 3)}-${truncated.slice(3, 6)}-${truncated.slice(
      6
    )}`;
  } else if (truncated.length >= 3) {
    return `${truncated.slice(0, 3)}-${truncated.slice(3)}`;
  }

  return truncated;
};

export const PhoneInput: React.FC<PhoneInputProps> = ({
  field,
  formClassName,
  disabled,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    field.onChange(formatted);
  };

  return (
    <InputItem
      name="Phone"
      placeholder="317-255-1414"
      field={{
        ...field,
        onChange: handleChange,
        disabled: disabled,
      }}
      formClassName={formClassName}
    />
  );
};
