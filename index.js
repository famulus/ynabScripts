//list any function that are never called

import ynab from "ynab"
import dotenv from "dotenv"
import {
  formatYNAB,
  formattedNumber,
  TRANSACTION_AMOUNT_DIVISOR,
} from "./helpers.js"

dotenv.config()

const STATEMENT_PERIOD_END_DAY = parseInt(process.env.STATEMENT_PERIOD_END_DAY)
const apiKey = process.env.YNAB_API_KEY
const ynabAPI = new ynab.API(apiKey)

const getStatementPeriod = async () => {
  const today = new Date()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()

  const statementStartDate = new Date(
    currentYear,
    currentMonth,
    STATEMENT_PERIOD_END_DAY + 1
  )
  const statementEndDate = new Date(
    currentYear,
    currentMonth + 1,
    STATEMENT_PERIOD_END_DAY
  )

  return { start: statementStartDate, end: statementEndDate }
}

const getAccounts = async () => {
  const {
    data: { budgets },
  } = await ynabAPI.budgets.getBudgets()
  const budgetId = budgets[0].id

  const {
    data: { accounts },
  } = await ynabAPI.accounts.getAccounts(budgetId)
  return { budgetId, accounts }
}

const fetchTransactionsByAccountAndDate = async (budgetId, accountId, startDate, endDate) => {
  const {
    data: { transactions },
  } = await ynabAPI.transactions.getTransactionsByAccount(budgetId, accountId, startDate, endDate)
  return transactions
}


// Fetches all transactions for a given account
const fetchAllTransactions = async (budgetId, accountId) => {
  const {
    data: { transactions },
  } = await ynabAPI.transactions.getTransactionsByAccount(budgetId, accountId)

  return transactions
}


// Filters transactions that occurred before a given date
const filterTransactionsBeforeDate = (transactions, date) => {
  return transactions.filter((transaction) => {
    const transactionDate = new Date(transaction.date)
    return transactionDate < date
  })
}

// Calculates the starting balance from a list of transactions
const calculateStartingBalanceFromTransactions = (transactions) => {
  return transactions.reduce((total, transaction) => {
    return total + transaction.amount / TRANSACTION_AMOUNT_DIVISOR
  }, 0)
}

// Gets the starting balance for an account, given a statement start date

const getStartingBalance = async (accountId, budgetId, statementStartDate) => {
  const allTransactions = await fetchAllTransactions(budgetId, accountId)
  const dayBeforeStartDate = new Date(statementStartDate)
  dayBeforeStartDate.setDate(statementStartDate.getDate() - 1)
  const transactionsBeforeStatement = filterTransactionsBeforeDate(
    allTransactions,
    dayBeforeStartDate
  )
  const startingBalance = calculateStartingBalanceFromTransactions(
    transactionsBeforeStatement
  )
  return startingBalance
}

// Creates a transaction map to store the sum of transaction amounts for each date
const createTransactionMap = (transactions) => {
  return transactions.reduce((map, transaction) => {
    const transactionDate = new Date(transaction.date)
    const dateString = transactionDate.toISOString().split("T")[0]
    if (!map[dateString]) {
      map[dateString] = 0
    }
    map[dateString] += transaction.amount / TRANSACTION_AMOUNT_DIVISOR
    return map
  }, {})
}

// Computes the average daily balance using the transaction map and the starting balance
const computeAverageDailyBalance = (
  transactionMap,
  startingBalance,
  startDate,
  endDate
) => {
  let currentBalance = startingBalance
  let totalBalance = 0
  let daysInStatement = 0

  for (
    let date = new Date(startDate);
    date <= endDate;
    date.setDate(date.getDate() + 1)
  ) {
    const dateString = date.toISOString().split("T")[0]

    if (transactionMap[dateString]) {
      currentBalance += transactionMap[dateString]
    }

    totalBalance += currentBalance
    daysInStatement++
  }

  return totalBalance / daysInStatement
}

// entry point for main calculation
const calculateAverageDailyBalance = async (
  accountId,
  budgetId,
  startDate,
  endDate,
  transactions
) => {
  const startingBalance = await getStartingBalance(
    accountId,
    budgetId,
    startDate,
    transactions
  )

  const transactionMap = createTransactionMap(transactions)
  const averageDailyBalance = computeAverageDailyBalance(
    transactionMap,
    startingBalance,
    startDate,
    endDate
  )

  return averageDailyBalance
}


// Function to log the account name and calculated average daily balance
const logAccountAndBalance = (accountName, averageDailyBalance) => {
  console.log(`Account: ${accountName}`)
  console.log(
    `Average Daily Balance: ${formattedNumber.format(averageDailyBalance)}\n`
  )
}

const main = async () => {
  // Get the statement period (start and end dates)
  const { start: statementStartDate, end: statementEndDate } =
    await getStatementPeriod()

  // Get the budget ID and the list of accounts
  const { budgetId, accounts } = await getAccounts()

  // Loop through the accounts (in this case, only the second account in the list)
  // for (const account of [accounts[1]]) {
  for (const account of accounts) {
    // Fetch all transactions for the current account within the statement period
    const transactions = await fetchTransactionsByAccountAndDate(
      budgetId,
      account.id,
      statementStartDate,
      statementEndDate
    )

    // Calculate the average daily balance for the current account within the statement period
    const averageDailyBalance = await calculateAverageDailyBalance(
      account.id,
      budgetId,
      statementStartDate,
      statementEndDate,
      transactions
    )

    // Log the account name and the calculated average daily balance
    if (process.env.NODE_ENV != "test") {
      // Code that will not run during testing
      logAccountAndBalance(account.name, averageDailyBalance)
    }
  }
}

main().catch((error) => {
  debugger
  console.error("Error:", error)
})

export {
  getStatementPeriod,
  getAccounts,
  fetchAllTransactions,
  filterTransactionsBeforeDate,
  calculateStartingBalanceFromTransactions,
  getStartingBalance,
  createTransactionMap,
  computeAverageDailyBalance,
  calculateAverageDailyBalance,
  logAccountAndBalance,
  main,
}
