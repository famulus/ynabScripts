const config = require('./config'); 

const _ = require("underscore");
const ynab = require("ynab");
const moment = require("moment");
const ynabAPI = new ynab.API(config.accessToken);
const budget_id = config.budget_id; // main budget

const targetAverageDailyBalace = 11000.0;

function formatMoney(number) {
	return number.toLocaleString("en-US", {
		style: "currency",
		currency: "USD",
	});
}

function formatYNAB(number) {
	return formatMoney(number / 1000);
}

(async function () {
	// ----------------------grab data -------------------

	const monthResp = await ynabAPI.months.getBudgetMonth(
		budget_id,
		"2023-01-01"
	);
	categoriesData = monthResp.data.month.categories;
	// console.log(categoriesData)

	const accountsResp = await ynabAPI.accounts.getAccounts(budget_id);
	accountsData = accountsResp.data.accounts;
	// console.log(accountsData)

	const txResp = await ynabAPI.transactions.getTransactions(budget_id);
	const txData = txResp.data.transactions;
	// console.log(txData)

	// ---------------------- join:  account -< transactions >- category -------------------

	const accountForCategory = _.map(categoriesData, (category) => {
		//grab all the tx connected to this category
		const txForCategory = _.filter(txData, (tx, index) => {
			return tx.category_id == category.id;
		});

		const lastTx = txForCategory[txForCategory.length - 1];
		var account_type = [{ type: null }];
		if (lastTx) {
			account_type = _.filter(accountsData, (account, index) => {
				return account.id == lastTx.account_id;
			});
			category["account_type"] = account_type[0].type;
		} else {
			category["account_type"] = null;
		}

		return category;
	});

	// ----------------------monthly repeating categories -------------------

	const monthlyRepeatingCategories = _.filter(
		accountForCategory,
		(category, index) => {
			if (!category) {
				return false;
			}
			const repeating = /\([0-9]/.test(category.name);
			const include = repeating && (category.hidden == false)
			return include
		}
	);

	const repeatingCashFlow = _.reduce(
		monthlyRepeatingCategories,
		(memo, month) => {
			const sumOfTargets = month.goal_target + memo;
			return sumOfTargets;
		},
		0
	);

	console.log("Repeating Cash Flows, cash and credit");
	console.log(formatYNAB(repeatingCashFlow));

	// ----------------------iterate months -------------------

	const monthKeys = [...Array(12).keys()];
	const monthsTarget = _.map(monthKeys, (monthKey) => {
		const fullMonth = moment().month(monthKey).startOf("date");
		// ----------------------categories in this month, checking, specific month -------------------
		var monthCategorySummaryCash = _.filter(
			accountForCategory,
			(monthlyCategory) => {
				if (
					monthlyCategory &&
					monthlyCategory.goal_target_month &&
					moment(monthlyCategory.goal_target_month).month() ==
						fullMonth.month() &&
					monthlyCategory.hidden == false &&
					!(moment(monthlyCategory.goal_target_month).year() > moment().year()) &&
					(monthlyCategory.account_type == "checking" ||
						monthlyCategory.account_type == "cash" ||
						monthlyCategory.account_type == null)
				) {
					// console.log(monthlyCategory.account_type)
					return true;
				} else {
					// console.log(monthlyCategory.account_type)
					return false;
				}
			}
		);

		// ----------------------categories in last month, credit, specific month -------------------
		var monthCategorySummaryCredit = _.filter(
			accountForCategory,
			(monthlyCategory) => {
				if (
					monthlyCategory &&
					monthlyCategory.goal_target_month &&
					monthlyCategory.hidden == false &&
					!(moment(monthlyCategory.goal_target_month).year() > moment().year()) &&

					moment(monthlyCategory.goal_target_month)
						.add(2, "months")
						.month() == fullMonth.month() &&
					monthlyCategory.account_type == "creditCard"
				) {
					return true;
				} else {
					return false;
				}
			}
		);

		// ----------------------combine category arrays -------------------
		const monthlySpecificPlusRepeating = [].concat(
			monthlyRepeatingCategories,
			monthCategorySummaryCash,
			monthCategorySummaryCredit
		);

		// ----------------------summary calculations -------------------
		const monthCategorySummaryReduced = _.map(
			monthlySpecificPlusRepeating,
			(month) => {
				return `${month.name}: ${formatYNAB(month.goal_target)}`;
			}
		);

		const monthCashFlow = _.reduce(
			monthlySpecificPlusRepeating,
			(memo, month) => {
				if (month) {
					return memo + month.goal_target;
				}
			},
			0
		);
		const monthCashFlowFormatted = formatYNAB(monthCashFlow);
		const specificMonthBalanceFormatted = formatYNAB(
			monthCashFlow / 2 + targetAverageDailyBalace * 1000
		);

		// ----------------------return -------------------
		return {
			month: monthKey + 1,
			targetBalance: specificMonthBalanceFormatted,
			cashFlowAmount: monthCashFlowFormatted,
			thisMonth: monthCategorySummaryReduced,
		};
	});

	console.log("\n\nMonth Specific Cash Flows:");
	console.log(monthsTarget);

	// ----------------------data -------------------

	// id: 'd93aa345-d087-4ee5-b572-5b3257e7b811',
	// category_group_id: '72da902c-4299-4791-8cda-2ffa51ddc0d3',
	// name: 'HealthFirst (1st)🔹',
	// hidden: false,
	// original_category_group_id: null,
	// note: null,
	// budgeted: 549740,
	// activity: -549880,
	// balance: 0,
	// goal_type: 'NEED',
	// goal_creation_month: '2022-11-01',
	// goal_target: 549880,
	// goal_target_month: null,
	// goal_percentage_complete: 100,
	// goal_months_to_budget: 1,
	// goal_under_funded: 0,
	// goal_overall_funded: 549880,
	// goal_overall_left: 0,
	// deleted: false
})();
