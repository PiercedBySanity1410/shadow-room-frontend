import React, { type SVGProps } from "react";

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: string | number;
  color?: string;
}
export const LogoIcon: React.FC<IconProps> = ({
  size = 18,
  color = "white",
  style,
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 80 105"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      style={{ color, ...style }}
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0 50V20L40 0L80 20V50L60 60L40 50L20 60L0 50ZM40 20L20 30V40L40 30L60 40V30L40 20Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0 60V85L40 105L80 85V60L60 70L40 60L20 70L0 60ZM40 70L20 80L40 90L60 80L40 70Z"
        fill="currentColor"
      />
    </svg>
  );
};

export const UserIcon: React.FC<IconProps> = ({
  size = 18,
  color = "white",
  style,
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      style={{ color, ...style }}
      {...props}
    >
      <path
        d="M12.4499 6.69998C12.6332 7.06665 12.7416 7.48332 12.7416 7.92498C12.7332 9.39998 11.5749 10.6083 10.1082 10.65C10.0499 10.6417 9.9749 10.6417 9.90824 10.65C8.44157 10.6 7.2749 9.39998 7.2749 7.92498C7.2749 6.41665 8.49157 5.19165 10.0082 5.19165"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.6166 16.15C14.1333 17.5084 12.1666 18.3334 9.99997 18.3334C7.8333 18.3334 5.86663 17.5084 4.3833 16.15C4.46663 15.3667 4.96663 14.6 5.8583 14C8.14163 12.4834 11.875 12.4834 14.1416 14C15.0333 14.6 15.5333 15.3667 15.6166 16.15Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.33341 5.00008C2.29175 6.39175 1.66675 8.12508 1.66675 10.0001C1.66675 14.6001 5.40008 18.3334 10.0001 18.3334C14.6001 18.3334 18.3334 14.6001 18.3334 10.0001C18.3334 5.40008 14.6001 1.66675 10.0001 1.66675C8.80841 1.66675 7.66675 1.91675 6.64175 2.37508"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
export const ArrowLeftIcon: React.FC<IconProps> = ({
  size = 18,
  color = "white",
  style,
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      style={{ color, ...style }}
      {...props}
    >
      <path
        d="M9.57 5.93005L3.5 12.0001L9.57 18.0701"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20.5 12H3.67001"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
export const ArrowRightIcon: React.FC<IconProps> = ({
  size = 18,
  color = "white",
  style,
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      style={{ color, ...style }}
      {...props}
    >
      <path
        d="M12.0251 4.94165L17.0835 9.99998L12.0251 15.0583"
        stroke="currentColor"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.17505 10H16.9417"
        stroke="currentColor"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2.91675 10H5.80841"
        stroke="currentColor"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const RefreshIcon: React.FC<IconProps> = ({
  size = 18,
  color = "white",
  style,
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      style={{ color, ...style }}
      {...props}
    >
      <path
        d="M9.69992 14.4466C12.5599 13.6933 14.6666 11.0933 14.6666 7.99992C14.6666 4.31992 11.7066 1.33325 7.99992 1.33325C3.55325 1.33325 1.33325 5.03992 1.33325 5.03992M4.29325 5.03992H2.67325H1.33325V1.99992"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M1.33325 8C1.33325 11.68 4.31992 14.6667 7.99992 14.6667"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="3 3"
      />
    </svg>
  );
};

export const SearchIcon: React.FC<IconProps> = ({
  size = 18,
  color = "white",
  style,
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      style={{ color, ...style }}
      {...props}
    >
      <path
        d="M11 2C15.97 2 20 6.03 20 11C20 15.97 15.97 20 11 20C6.03 20 2 15.97 2 11C2 7.5 4 4.46 6.93 2.97"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.07 20.97C19.6 22.57 20.81 22.73 21.74 21.33C22.6 20.05 22.04 19 20.5 19C19.35 19 18.71 19.89 19.07 20.97Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const PlusIcon: React.FC<IconProps> = ({
  size = 18,
  color = "white",
  style,
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      style={{ color, ...style }}
      {...props}
    >
      <path
        d="M6 12H18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 18V6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const DoubleCheckIcon: React.FC<IconProps> = ({
  size = 18,
  color = "white", // Note: original had a specific blue "#34B7F1", can be overridden via color prop
  style,
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 19 11"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      style={{ color, ...style }}
      {...props}
    >
      <path
        d="M13 1L4.5 9.5L1 6M18 1L9.5 9.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const SettingsIcon: React.FC<IconProps> = ({
  size = 18,
  color = "white",
  style,
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      style={{ color, ...style }}
      {...props}
    >
      <path
        d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
        stroke="currentColor"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2 12.8799V11.1199C2 10.0799 2.85 9.21994 3.9 9.21994C5.71 9.21994 6.45 7.93994 5.54 6.36994C5.02 5.46994 5.33 4.29994 6.24 3.77994L7.97 2.78994C8.76 2.31994 9.78 2.59994 10.25 3.38994L10.36 3.57994C11.26 5.14994 12.74 5.14994 13.65 3.57994L13.76 3.38994C14.23 2.59994 15.25 2.31994 16.04 2.78994L17.77 3.77994C18.68 4.29994 18.99 5.46994 18.47 6.36994C17.56 7.93994 18.3 9.21994 20.11 9.21994C21.15 9.21994 22.01 10.0699 22.01 11.1199V12.8799C22.01 13.9199 21.16 14.7799 20.11 14.7799C18.3 14.7799 17.56 16.0599 18.47 17.6299C18.99 18.5399 18.68 19.6999 17.77 20.2199L16.04 21.2099C15.25 21.6799 14.23 21.3999 13.76 20.6099L13.65 20.4199C12.75 18.8499 11.27 18.8499 10.36 20.4199L10.25 20.6099C9.78 21.3999 8.76 21.6799 7.97 21.2099L6.24 20.2199C5.33 19.6999 5.02 18.5299 5.54 17.6299C6.45 16.0599 5.71 14.7799 3.9 14.7799C2.85 14.7799 2 13.9199 2 12.8799Z"
        stroke="currentColor"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const UsersIcon: React.FC<IconProps> = ({
  size = 18,
  color = "white",
  style,
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      style={{ color, ...style }}
      {...props}
    >
      <path
        d="M9.6 10.87C9.5 10.86 9.38 10.86 9.27 10.87C6.89 10.79 5 8.84 5 6.44C5 3.99 6.98 2 9.44 2C11.89 2 13.88 3.99 13.88 6.44C13.87 8.84 11.98 10.79 9.6 10.87Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.4103 4C18.3503 4 19.9103 5.57 19.9103 7.5C19.9103 9.39 18.4103 10.93 16.5403 11C16.4603 10.99 16.3703 10.99 16.2803 11"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.815 14.3725C1.395 15.9925 1.395 18.6325 3.815 20.2425C6.565 22.0825 11.075 22.0825 13.825 20.2425C16.245 18.6225 16.245 15.9825 13.825 14.3725C11.085 12.5425 6.575 12.5425 3.815 14.3725Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.3398 20C19.0598 19.85 19.7398 19.56 20.2998 19.13C21.8598 17.96 21.8598 16.03 20.2998 14.86C19.7498 14.44 19.0798 14.16 18.3698 14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const AddUserIcon: React.FC<IconProps> = ({
  size = 18,
  color = "white",
  style,
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      style={{ color, ...style }}
      {...props}
    >
      <path
        d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.41016 22C3.41016 18.13 7.26015 15 12.0002 15C12.9602 15 13.8902 15.13 14.7602 15.37"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22 18C22 18.32 21.96 18.63 21.88 18.93C21.79 19.33 21.63 19.72 21.42 20.06C20.73 21.22 19.46 22 18 22C16.97 22 16.04 21.61 15.34 20.97C15.04 20.71 14.78 20.4 14.58 20.06C14.21 19.46 14 18.75 14 18C14 16.92 14.43 15.93 15.13 15.21C15.86 14.46 16.88 14 18 14C19.18 14 20.25 14.51 20.97 15.33C21.61 16.04 22 16.98 22 18Z"
        stroke="currentColor"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.4897 17.98H16.5098"
        stroke="currentColor"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 16.52V19.51"
        stroke="currentColor"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
export const SendIcon: React.FC<IconProps> = ({
  size = 18,
  color = "white",
  style,
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      style={{ color, ...style }}
      {...props}
    >
      <path
        d="M13.2414 2.90834C16.4164 1.85001 18.1414 3.58334 17.0914 6.75834L14.7331 13.8333C13.1497 18.5917 10.5497 18.5917 8.96641 13.8333L8.26641 11.7333L6.16641 11.0333C1.40807 9.45001 1.40807 6.85834 6.16641 5.26667L9.99974 3.99167"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.4248 11.375L11.4081 8.3833"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
export const CloseIcon: React.FC<IconProps> = ({
  size = 18,
  color = "white",
  style,
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 13 13"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      style={{ color, ...style }}
      {...props}
    >
      <path
        d="M0.500977 0.5L12.5001 12.4991"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M0.499892 12.4991L12.499 0.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const DeleteIcon: React.FC<IconProps> = ({
  size = 18,
  color = "white",
  style,
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      style={{ color, ...style }}
      {...props}
    >
      <path
        d="M21 5.97998C17.67 5.64998 14.32 5.47998 10.98 5.47998C9 5.47998 7.02 5.57998 5.04 5.77998L3 5.97998"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 4.97L8.72 3.66C8.88 2.71 9 2 10.69 2H13.31C15 2 15.13 2.75 15.28 3.67L15.5 4.97"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.2099 21.9999H8.7899C5.9999 21.9999 5.9099 20.7799 5.7999 19.2099L5.1499 9.13989"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.8502 9.13989L18.2002 19.2099"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.3301 16.5H13.6601"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.8198 12.5H14.4998"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 12.5H10.33"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
