import * as React from "react";
import { FormInput, type FormInputProps } from "../shared/form-input";

export type InputProps = FormInputProps;

const Input = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  return <FormInput ref={ref} {...props} />;
});
Input.displayName = "Input";

export { Input };
