
require("./User.js");
require("./PushNotification.js");
require("./Message.js");
require("./Category.js");
require("./Vehicle.js");
require("./Email.js");
require("./Document.js");
require("./UserDocument.js");
require("./Address.js");
require("./Travel.js");
require("./Fare.js");
require("./Card.js");
require("./Coupon.js");
require("./BankAccount.js");
require("./Config.js");
require("./Activity.js");
require("./ContactUs.js");
require("./Help.js");
require("./Plan.js");
require("./StatesAndCities.js");
require("./Bonus.js");
require("./RegistrationFee.js");
require("./PaymentManager.js");
require("./SMS/SMS.js");
require("./Payment/Payment.js");
require("./Maps/Maps.js");
require("./Logger.js");
require("./Job.js");
require("./Firebase.js").instance().initLive();
require("./Graduation.js");
require("./BilletLog.js");
require("./Mock.js");
require("./Cancellation.js");
const redis = require("./RedisJob.js").instance();
const receipt = require("./Receipt").instance();
require('./Payment/db/transaction');













// const Define = require("./Define.js");
// let query = new Parse.Query(Parse.User);
// query.exists("driverBonus");
// query.limit(10000);
// query.greaterThanOrEqualTo("driverBonus", 0.0001);
// query.select(["driverBonus"]);
// query.find().then(function (users) {
//     for (let i = 0; i < users.length; i++) {
//         users[i].set("driverBonus", 0);
//         // users[i].set("sharedGain", true);
//         // users[i].set("canGainShared", true);
//     }
//     return Parse.Object.saveAll(users, {useMasterKey: true});
// }).then(function () {
//     console.log(" saveAll ok")
// }, function (error) {
//     console.log(" error ok", error)
// })
// let query = new Parse.Query(Define.BonusTravelHistory);
// query.equalTo("date", "6/2019");
// query.equalTo("type", "sharedGain");
// query.limit(10000);
// query.select(["blocked", "paid", "refund"]);
// query.find().then(function (users) {
//     for (let i = 0; i < users.length; i++) {
//         users[i].set("blocked", true);
//         users[i].unset("paid");
//         users[i].unset("refund");
//         // users[i].set("sharedGain", true);
//         // users[i].set("canGainShared", true);
//     }
//     return Parse.Object.saveAll(users, {useMasterKey: true});
// }).then(function () {
//     console.log(" saveAll ok")
// }, function (error) {
//     console.log(" error ok", error)
// })

//
// let query = new Parse.Query(Define.MonthlyGain);
// query.equalTo("month", "6/2019");
// query.greaterThanOrEqualTo("value", 100);
// query.include("driver");
// query.select(["driver.canGainShared", "driver.sharedGain"]);
// return query.find().then(function (ob) {
//     let users = [], mapU = {};
//     for (let i = 0; i < ob.length; i++) {
//         let d = ob[i].get("driver");
//         d.set("canGainShared", true);
//         users.push(d);
//         if (!mapU[d.id]) mapU[d.id] = true;
//         else {
//             console.log('d', d.id)
//         }
//     }
//     return Parse.Object.saveAll(users, {useMasterKey: true});
// }).then(function () {
//     console.log(" updateTotalTravelsOfUser ok")
// }, function (error) {
//     console.log(" error ok", error)
// })
// require("./Bonus.js").instance().updateGainMonthly(0).then(function () {
//     console.log(" updateTotalTravelsOfUser ok")
// }, function (error) {
//     console.log(" error ok", error)
// })
// let t = 0, can = 0, cant = 0;
//
// function verifyUsers(user) {
//     let queryTravel = new Parse.Query(Parse.Object.extend("Travel"));
//     queryTravel.equalTo("status", "completed");
//     queryTravel.equalTo("driver", user);
//     queryTravel.select(["valueDriver","value"]);
//     queryTravel.limit(100000);
//     return queryTravel.find().then(function (travels) {
//         t += travels.length;
//         let sum = 0;
//         for (let i = 0; i < travels.length; i++) {
//             sum += travels[i].get("value");
//         }
//         if (sum >= 100) {
//             can++;
//             user.set("canGainShared", true);
//         } else {
//             cant++;
//             user.set("canGainShared", false);
//         }
//         user.set("gainMonth", sum);
//         // return user.save(null, {useMasterKey: true});
//         return Promise.resolve();
//     })
// }
//
// let query = new Parse.Query(Parse.User);
// query.equalTo("sharedGain", true);
// query.limit(500);
// return query.find().then(function (us) {
//     let promises = [];
//     for (let i = 0; i < us.length; i++) {
//         promises.push(verifyUsers(us[i]))
//     }
//     return Promise.when(promises);
// }).then(function () {
//     console.log("DONE")
//     console.log("raves", t)
//     console.log("can ", can)
//     console.log("cant", cant)
//
// }, function (error) {
//     console.log("error", error)
//
// })
// require("./Payment/Payment.js").instance().migrateBankAccount().then(function () {
//     console.log(" migrateBankAccount ok ")
// })
// require("./Payment/Payment.js").instance().migrateUser().then(function () {
//     console.log(" migrateUser ok ")
// })
// require("./Bonus.js").instance().generateUserTree();

// let query = new Parse.Query(Parse.User);
// query.limit(2000);
// query.select(["name", "email", "cpf"]);
// return query.find().then(function (u) {
//     let map = {}, cont=1;
//     for (let i = 0; i < u.length; i++) {
//         if (!map[u[i].get("cpf")]) {
//             map[u[i].get("cpf")] = {name: u[i].get("name"), email: u[i].get("username"), cpf: u[i].get("cpf")};
//         }
//         else{
//             console.log(map[u[i].get("cpf")])
//             console.log({name: u[i].get("name"), email: u[i].get("username"), cpf: u[i].get("cpf")})
//             console.log("________________",cont++)
//         }
//     }
//     console.log("END")
// });


