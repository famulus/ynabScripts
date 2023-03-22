import ynab from "ynab";
import dotenv from "dotenv";
import { formatYNAB, TRANSACTION_AMOUNT_DIVISOR } from "./helpers.js";

dotenv.config();

// Constants

const apiKey = process.env.YNAB_API_KEY;
const ynabAPI = new ynab.API(apiKey);
const targetAverageDailyBalance = 11000.0;


// Fetch all budgets and return an array of budget ids and names
const getAllBudgets = async () => {
  try {
    const {
      data: { budgets },
    } = await ynabAPI.budgets.getBudgets();

    const budgetIdAndNameArray = budgets.map((budget) => ({
      id: budget.id,
      name: budget.name,
    }));

    return budgetIdAndNameArray;
  } catch (error) {
    console.error("Error fetching budgets:", error);
    return [];
  }
};

// Fetch category, account and transaction data for a given budget_id
const fetchData = async (budget_id) => {
  try {
    const [monthResp, accountsResp, txResp] = await Promise.all([
      ynabAPI.months.getBudgetMonth(budget_id, "2023-01-01"),
      ynabAPI.accounts.getAccounts(budget_id),
      ynabAPI.transactions.getTransactions(budget_id),
    ]);

    const categoriesData = monthResp.data.month.categories;
    const accountsData = accountsResp.data.accounts;
    const txData = txResp.data.transactions;

    return { categoriesData, accountsData, txData };
  } catch (error) {
    console.error("An error occurred:", error);
    return {};
  }
};

// Join category, account and transaction data
const joinAccountForCategory = (categoriesData, accountsData, txData) => {
  return categoriesData.map((category) => {
    const txForCategory = txData.filter((tx) => tx.category_id === category.id);
    const lastTx = txForCategory[txForCategory.length - 1];

    if (lastTx) {
      const account_type = accountsData.find(
        (account) => account.id === lastTx.account_id
      );
      category["account_type"] = account_type.type;
    } else {
      category["account_type"] = null;
    }

    return category;
  });
};
// Process the data by fetching and joining it

const processData = async (budget_id) => {
  const { categoriesData, accountsData, txData } = await fetchData(budget_id);
  const accountForCategory = joinAccountForCategory(
    categoriesData,
    accountsData,
    txData
  );
  return { accountForCategory, txData, accountsData };
};

// Display the processed data

const displayData = ({
  accountForCategory,
  txData,
  accountsData,
  targetAverageDailyBalance,
}) => {
  // ----------------------monthly repeating categories -------------------
  const monthlyRepeatingCategories = accountForCategory.filter((category) => {
    if (!category) {
      return false;
    }
    const repeating = /\([0-9]/.test(category.name);
    const include = repeating && !category.hidden;
    return include;
  });
  const repeatingCashFlow = monthlyRepeatingCategories.reduce(
    (memo, month) => memo + month.goal_target,
    0
  );
  console.log("Repeating Cash Flows, cash and credit");
  console.log(formatYNAB(repeatingCashFlow));

  // ----------------------iterate months -------------------
  // Generate an array of integers from 0 to 11 representing months
  const monthKeys = [...Array(12).keys()];
  // Iterate through monthKeys and create a new array with month data

  //convert to arrow format
  const filterCashAndCheckingAccounts = (accountForCategory, fullMonth) =>
    accountForCategory.filter((monthlyCategory) => {
      if (!monthlyCategory || !monthlyCategory.goal_target_month) {
        return false;
      }

      const categoryMonth = new Date(
        monthlyCategory.goal_target_month
      ).getMonth();
      const currentYear = new Date().getFullYear();
      const categoryYear = new Date(
        monthlyCategory.goal_target_month
      ).getFullYear();
      const fullMonthJs = fullMonth;

      return (
        categoryMonth === fullMonthJs.getMonth() &&
        !monthlyCategory.hidden &&
        categoryYear <= currentYear &&
        (monthlyCategory.account_type === "checking" ||
          monthlyCategory.account_type === "cash" ||
          monthlyCategory.account_type === null)
      );
    });

  const filterCreditAccounts = (accountForCategory, fullMonth) => {
    return accountForCategory.filter((monthlyCategory) => {
      if (!monthlyCategory || !monthlyCategory.goal_target_month) {
        return false;
      }

      const categoryMonth = new Date(
        monthlyCategory.goal_target_month
      ).getMonth();
      const currentYear = new Date().getFullYear();
      const categoryYear = new Date(
        monthlyCategory.goal_target_month
      ).getFullYear();
      const fullMonthJs = fullMonth;

      const categoryDate = new Date(monthlyCategory.goal_target_month);
      categoryDate.setMonth(categoryDate.getMonth() + 2);

      return (
        !monthlyCategory.hidden &&
        categoryYear <= currentYear &&
        categoryDate.getMonth() === fullMonthJs.getMonth() &&
        monthlyCategory.account_type === "creditCard"
      );
    });
  };
  const calculateMonthCashFlow = (monthlySpecificPlusRepeating) =>
    monthlySpecificPlusRepeating.reduce(
      (memo, month) => (month ? memo + month.goal_target : memo),
      0
    );

  //refactor into smaller functions
  const getMonthsTarget = (
    monthKeys,
    accountForCategory,
    monthlyRepeatingCategories
  ) => {
    return monthKeys.map((monthKey) => {
      const now = new Date();
      const fullMonth = new Date(now.getFullYear(), monthKey, 1);

      const monthCategorySummaryCash = filterCashAndCheckingAccounts(
        accountForCategory,
        fullMonth
      );
      const monthCategorySummaryCredit = filterCreditAccounts(
        accountForCategory,
        fullMonth
      );

      const monthlySpecificPlusRepeating = [
        ...monthlyRepeatingCategories,
        ...monthCategorySummaryCash,
        ...monthCategorySummaryCredit,
      ];

      const monthCategorySummaryReduced = monthlySpecificPlusRepeating.map(
        (month) => `${month.name}: ${formatYNAB(month.goal_target)}`
      );

      const monthCashFlow = calculateMonthCashFlow(
        monthlySpecificPlusRepeating
      );

      const monthCashFlowFormatted = formatYNAB(monthCashFlow);
      const specificMonthBalanceFormatted = formatYNAB(
        monthCashFlow / 2 +
          targetAverageDailyBalance * TRANSACTION_AMOUNT_DIVISOR
      );

      return {
        month: monthKey + 1,
        targetBalance: specificMonthBalanceFormatted,
        cashFlowAmount: monthCashFlowFormatted,
        thisMonth: monthCategorySummaryReduced,
      };
    });
  };

  // Get month target data and log it

  const monthsTarget = getMonthsTarget(
    monthKeys,
    accountForCategory,
    monthlyRepeatingCategories
  );
  console.log("\n\nMonth Specific Cash Flows:");
  console.log(monthsTarget);
};

// Main function
const main = async () => {
  const budgets = await getAllBudgets();
  const budget_id = budgets[0].id; // main budget

  const data = await processData(budget_id);
  displayData({ ...data, targetAverageDailyBalance: 11000.0 });
};

// Run the main function and handle errors
main().catch((error) => {
  console.error("Error:", error);
});
