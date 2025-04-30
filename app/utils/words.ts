export const capitalizeFirstLetter = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const replaceUnderscoresWithSpaces = (str: string) => {
  return capitalizeFirstLetter(str.replace(/_/g, " "));
};
