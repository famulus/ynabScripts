# YNAB Average Daily Balance

This code calculates the average daily balance for each account in your You Need a Budget (YNAB) budget within a specific statement period. The calculation takes into account all transactions that occurred within the specified period and computes the average daily balance.

## Installation

1. Install [Node.js](https://nodejs.org/) if you haven't already.
2. Clone the repository or download the code.
3. Navigate to the project directory in your terminal/command prompt.
4. Run `npm install` to install all necessary dependencies.

## Setup

1. Create an `.env` file in the project directory.
2. Add your YNAB API key to the `.env` file in the following format: `YNAB_API_KEY=your_api_key_here`.
3. Update the `STATEMENT_PERIOD_END_DAY` constant in the code to reflect the last day of your desired statement period.

## YNAB Personal Access Token
1. Log in to your YNAB account by visiting [app.youneedabudget.com](https://app.youneedabudget.com/).
2. Click on your account name in the lower-left corner of the screen. This will open a menu.
3. In the menu, click on `Account Settings`.
4. Scroll down to the `Developer` section.
5. Here, you will find your `Personal Access Token`. Click on `New Token` if you don't have one yet or if you want to generate a new one.
6. A pop-up window will appear. Enter your YNAB account password and click `Generate` to create a new token.
7. The newly generated token will appear in a text box. Make sure to copy and save it securely, as you won't be able to access it again.

**Note**: Your YNAB authorization token grants access to your YNAB account data. Keep it secure and never share it with anyone you don't trust.


## Usage

Run the code by executing `node index.js` in the terminal/command prompt. The average daily balance for each account in your YNAB budget will be displayed in the console.

## Example

Let's assume you have two accounts in your YNAB budget: "Checking" and "Savings". The statement period is set to end on the 3rd of each month. After running the code, you may see output similar to the following:

```
Account: Checking
Average Daily Balance: $1,234.56

Account: Savings
Average Daily Balance: $5,678.90
```

This output indicates that the average daily balance for the "Checking" account within the statement period is $1,234.56, and the average daily balance for the "Savings" account is $5,678.90.
