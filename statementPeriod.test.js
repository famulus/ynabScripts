const { getStatementPeriod } = require('./index'); // Update the path to the module containing the getStatementPeriod function
const STATEMENT_PERIOD_END_DAY = 3;

describe('getStatementPeriod', () => {
  test('should return statement start and end dates for the current month', async () => {
    const { start, end } = await getStatementPeriod();

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const expectedStartDate = new Date(currentYear, currentMonth, STATEMENT_PERIOD_END_DAY + 1);
    const expectedEndDate = new Date(currentYear, currentMonth + 1, STATEMENT_PERIOD_END_DAY);

    expect(start).toEqual(expectedStartDate);
    expect(end).toEqual(expectedEndDate);
  });
});
