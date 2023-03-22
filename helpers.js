const TRANSACTION_AMOUNT_DIVISOR = 1000;

const formattedNumber = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatYNAB = (number) =>
  formattedNumber.format(number / TRANSACTION_AMOUNT_DIVISOR);

export { formatYNAB,formattedNumber, TRANSACTION_AMOUNT_DIVISOR };
