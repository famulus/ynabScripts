const config = require('./config'); 


const _ = require("underscore");
const moment = require("moment");
const ynab = require("ynab");
const ynabAPI = new ynab.API(config.accessToken);

// ----------------------helpers -------------------

function formatMoney(number) {
	return number.toLocaleString("en-US", {
		style: "currency",
		currency: "USD",
	});
}

function formatYNAB(number) {
	return formatMoney(number / 1000);
}

const accountCreationDate = moment("2023-01-03"); //statement date for account

var transactions;

// ----------------------main wrapper -------------------
(async function () {
	// ----------------------grab data -------------------
	const accountsResp = await ynabAPI.accounts.getAccounts(config.budget_id);
	const accountsData = accountsResp.data.accounts;
	const thisAccount = _.find(accountsData, (account) => {
		return account.id == config.account_id;
	});

	const transactionsResponse =
		await ynabAPI.transactions.getTransactionsByAccount(
			config.budget_id,
			config.account_id
		);
	transactions = transactionsResponse.data.transactions;

	// ---------------------- determine days with transactions -------------------
	var uniqDays = Array.from(
		new Set(
			_.map(transactions, (tx) => {
				return tx.date;
			})
		)
	);

	// console.log("\nDays with Transactions:");
	// console.log(uniqDays);

	const first_transaction_date = moment.min(
		_.map(uniqDays, (day) => {
			return moment(day);
		})
	);
	const AccountFirstOfMonth = accountCreationDate.date();
	console.log("\nAccount:");
	console.log(thisAccount.name);
	console.log("\nAccount Statement Date:");
	console.log(accountCreationDate.format("Do"));

	const theAbstractNow = moment();
	// ---------------------- are we before, on, or after statement date -------------------

	if (theAbstractNow.date() > AccountFirstOfMonth) {
		// console.log("AFTER 3rd");
		//filter transactions greater than the 3rd of current month.
		uniqDays = _.filter(uniqDays, (day) => {
			return (
				moment().date(AccountFirstOfMonth).dayOfYear() <=
				moment(day).dayOfYear()
			);
		});
	}
	if (theAbstractNow.date() <= AccountFirstOfMonth) {
		// if(true){
		// console.log("BEFORE 3rd");
		//filter transactions greater than the 3rd of previous month.
		const a_month_ago = moment()
			.subtract(1, "months")
			.startOf("date")
			.date(AccountFirstOfMonth);
		uniqDays = _.filter(uniqDays, (day) => {
			// console.log("previous_month")
			// console.log(moment(day).diff(a_month_ago,'days') > 0)
			return moment(day).diff(a_month_ago, "days") > 0;
		});
	}

	const min_day = moment(
		_.min(uniqDays, (day) => {
			return moment(day);
		})
	);
	// ---------------------- calculate time span -------------------
	const max_day = moment().startOf("date"); //today
	const span = max_day.diff(min_day, "days");

	console.log("\nDays into Current Cycle: ");
	console.log(span);

	const processed = _.map(uniqDays, (uniq_day, index) => {
		//grab the transactions in current day
		var daily_tx = _.filter(transactions, function (tx) {
			return tx.date == uniq_day;
		});

		daily_tx = _.sortBy(daily_tx, (tx) => {
			return tx.amount;
		});
		// get the net change for this day
		const net_change = _.reduce(
			daily_tx,
			function (memo, tx) {
				return memo + tx.amount;
			},
			0
		);
		// 	calc the days between this tx and next
		var days_between = moment(uniqDays[index + 1]).diff(
			moment(uniq_day),
			"days"
		);
		if (index + 1 == uniqDays.length) {
			//
			days_between = moment().diff(moment(uniq_day), "days") + 1;
		}

		return [uniq_day, net_change, days_between];
	});

	// ---------------------- sum the dayBalances -------------------
	const sum_balances = _.map(processed, (day, index) => {
		var running_balance = processed[index][1];

		if (index > 0) {
			running_balance = processed[index][1] + processed[index - 1][3];
		}

		const average_daily_balance = running_balance * day[2];

		day.push(running_balance);
		day.push(average_daily_balance);
		return day;
	});

	console.log(sum_balances);
	const sum_avb = _.reduce(
		sum_balances,
		function (memo, day) {
			return memo + day[4];
		},
		0
	);
	const average_daily_balance = sum_avb / span;
	// ---------------------- results -------------------
	console.log("\nAverage Daily Balance up to Today:");
	console.log(formatYNAB(average_daily_balance));

	// ---------------------- balance projection -------------------
	var sum_balances_projection_last_row = _.last(sum_balances);
	const daysInStatementPeriod = moment() 
		.date(AccountFirstOfMonth).daysInMonth()-1;

	var days_left_in_period = moment() 
		.date(AccountFirstOfMonth)
		.add(1,'month')
		.subtract(1, 'day')
		.diff(moment(sum_balances_projection_last_row[0]), 'days')
		 


	// var days_left_in_period = moment() //span from last transaction to end of statment
	// 	.date(AccountFirstOfMonth)
	// 	.add(1, "month")
	// 	.subtract(1,'days')
	// 	.diff(moment(), "days");

	sum_balances_projection_last_row[2] = days_left_in_period;
	sum_balances_projection_last_row[4] =
		days_left_in_period * sum_balances_projection_last_row[3];

		//update the last row so number of days extends to end of statement period
	var sum_balances_projection = sum_balances;
	sum_balances_projection[sum_balances.length - 1] =
		sum_balances_projection_last_row;

	const sum_avb_projection = _.reduce(
		sum_balances_projection,
		function (memo, day) {
			return memo + day[4];
		},
		0
	);
	const average_daily_balance_projection =
		sum_avb_projection / 
		_.reduce(
			sum_balances_projection,
			(memo, day) => {
				return memo + day[2];
			},
			0
		);

	// ---------------------- results -------------------
	console.log(
		"\n\ndaysInStatementPeriod:"
	);
	console.log(daysInStatementPeriod);
	console.log(
		"\n\ndays left in period:"
	);
	console.log(days_left_in_period);
	// console.log(sum_balances_projection_last_row);
	// console.log(sum_balances_projection);//array
	// console.log(sum_avb_projection);
	console.log(
		"\n\nProjected Average Daily Balance (Assuming no further transactions):"
	);
	console.log(formatYNAB(average_daily_balance_projection));
	console.log("\n\n");
})();
