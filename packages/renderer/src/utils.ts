export const formatSeconds = (seconds: string | number): string => {
  return `${Math.floor(+seconds / 60)}:${(+seconds % 60).toString(10).padStart(2, '0')}`;
};

export const cleanLocationString = (location: string): string => {
  return decodeURI(location).replaceAll('%26', '&');
};
