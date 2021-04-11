/**
 * Created by Patrick on 03/05/2017.
 */
const conf = require('config');
let Messages = {
    payment: {
        BONUS: "Bonus",
        MONEY: "Money"
    },
    success: {
        CREATED_SUCCESS: "The object was successfully created.",
        DOWNLOAD_SUCCESS: "Download successful",
        DELETED_SUCCESS: "The object was successfully removed",
        EDITED_SUCCESS: "The object was updated successfully",
        VALIDATION_SUCCESS: "Cell phone successfully validated",
        SEND_EMAIL_SUCCESS: "Message sent successfully",
        RECOVER_EMAIL_SUCCESS: "Follow the steps to send email to reset your password",
        PASSWORD_CHANGED: "Password changed successfully",
        PUSH_SENT: "Notification sent successfully",
        LOCATION_ENABLED: "We are operating in the region!",
        ALL_OK: "You are ready to receive calls!",
        MAKE_PASSENGER: "This driver became a passenger",
        WITHDRAW_SUCCESS: "The amount has been successfully transferred to your account!",
        BILLET_SENT: "The ticket has been sent to the user's email",
        CANCELLATION_FEE: "The cancellation of this trip can cause an charge of {{fee}}",
        CANCELLATION_FEE_DRIVER_TO_CLIENT: "The cancellation of this trip can cause an charge to the client of R$ {{fee}}, our team will analyse this travel and in case of bad behavior you can be pinished.",
    },
    push: {
        indication_code: "A friend used your referral code",
        noDrivers: "There are no drivers available in the region.",
        requestTravel: "New travel request",
        travelAccepted: "{{driver}} will arrive soon in a {{vehicle}}.",
        driverWaiting: "The {{driver}} has arrived at the place of departure.",
        travelAlreadyAccepted: conf.IdWall ? "Race accepted by another driver. " : " Race accepted by another driver.",
        travelCancelledByDriver: "A {{driver}} canceled the trip.",
        initTravel: "Your trip was started.",
        initScheduledTravel: "Starting your scheduled trip.",
        driverComing: "Driver arriving, please wait at the indicated place.",
        driverArrived: "Driver has reached the point of meeting with the customer.",
        completeTravel: "Travel completed, rate your experience!",
        registerAccepted: "Your registration has been approved!",
        registerDeny: "Your registration has been denied!",
        driversBusy: "Our drivers are currently busy",
        rejectValidation: "Oops! Your profile has not been approved, please try again.",
        approveValidation: ("Uhul! You are now a certified " + conf.appName + " professional."),
        approvePoddValidation: "Congratulations {{driver}}! You are now cooperative, your number is {{enrollment}}",
        blockUser: "Oops, your profile has been blocked.",
        blockedByCNH: "Oops! Your profile has been locked because your driver's license has expired",
        blockedByDoc: "Oops! Your profile has been locked because one of your documents has expired. Expired Document: ",
        unblockUser: "Uhul! Your profile has been unlocked.",
        newMessage: "You received a new message in chat",
        cpfValid: "Your registration has been approved!",
        cpfInvalid: "Your registration has been denied due to CPF.",
        cantReceiveTravel: "We have identified an inactivity in your app. Open it and get back online to receive calls.",
        smsCodeMessage: "Your activation code is: ",
        approveVehicle: "Your vehicle has just been approved.",
        rejectVehicle: "Oops! Your vehicle has been disapproved. Contact us for more information.",
        sendAlertCNH: "WARNING: Your driver's license will expire in 30 days. Regularize the situation.",
        editedPoint: "Hi your passenger has changed the travel route!",
        sendAlertDoc: "ATTENTION: Your document will expire in 30 days. Regularize the situation.",
        offlineBySystem: "You end up going offline due to inactivity",
        willBeOffline: "You did not attend {{x}} travels in a row. Do you want to go offline?"
    },
    reasons: {
        BLOCK_USER_IN_DEBT: {code: 730, message: "Your user has been blocked for debiting"},
        BLOCK_USER_ADMIN: {code: 731, message: "Your user is blocked! To return to using the application, contact us."},
        BLOCK_USER_CNH: {
            code: 732,
            message: "Your user is  blocked! Your CNH is expired, regularize your situation to return to using the application."
        },
        BLOCK_USER_EXAM: {
            code: 733,
            message: "Your user is  blocked!\n Check the status of your medical exam to return to using the app."
        },
        BLOCK_USER_CHECKCAR: {
            code: 734,
            message: "Your user is blocked! \n Check your vehicle's inspection status to re-use the application."
        },
    },
    balance: {
        BALANCE_AVAILABLE: "Balance available",
        BALANCE_AWAITING_FUNDS: "Locked Balance",
        BALANCE_IN_DEBT: "Debt Balance",
        BALANCE_AVAILABLE_WITH_NETWORK: "Balance available",
        BALANCE_AWAITING_FUNDS_WITH_NETWORK_AND_VALUE_IS_UNAVAILABLE: "Not available",
        BALANCE_AWAITING_FUNDS_WITH_NETWORK_AND_NOT_VALUE_IS_UNAVAILABLE: "Driver Earnings",
        BALANCE_IN_DEBT_NETWORK: "Passenger Earnings",
        BALANCE_NOT_RELEASED: "In transit values",
        NETWORK_VALUE: "Network Value",
        TRAVEL_VALUE: "Travels value"
    },
    statementValues: {
        travel_money: {
            title: "Ride on money (Taxas)",
            description1: "Money ID {{travelId}}",
            description2: "Wallet"
        },
        travel_card: {
            title: "Ride Complete",
            description1: "Card ID {{travelId}}",
            description2: "Balance available"
        },
        withdraw: {
            title: "Withdraw",
            description1: "Withdraw from the app",
            description2: "Balance available"
        },
        adminAction: {
            title: "Balance change by the manager",
            description1: "Performed by {{admin}}",
            description2: "Wallet"
        },
        billet: {
            title: "Boleto payment",
            description1: "Receipt of credit by boleto",
            description2: "Wallet"
        },
        cancellation: {
            title: "Cancellation fee",
            description1: "Canceled trip fee ID - {{travelId}}",
            description2: "Wallet"
        },
        initialDebt: {
            title: "Initial Value of the Portfolio",
            description1: "Present value in the Portfolio (Balance due) at the beginning of the registration of operations",
            description2: "Wallet"
        },
        initialBalance: {
            title: "Valor disponível inicial",
            description1: "Present value in the balance available at the beginning of the registration of operations",
            description2: "Wallet"
        }
    },
    invite: {
        FRIEND_INVITE: "<span> Your friend <b> {{name}} </b> used your invitation! </span>"
    },
    error: {
        ERROR_UNAUTHORIZED: "You are not logged in.",
        ERROR_OLD_VERSION_INTEGER: {code: 692, message: "Update your app to continue."},
        USERNAME_EXISTS: {code: 601, message: "This email is already being used."},
        INVALID_USERNAME: {code: 601, message: "Incorrect user name or password, please try again."},
        ERROR_EMAIL_NOT_FOUND: {code: 602, message: "This email is not in our database"},
        ERROR_USERNAME_NOT_FOUND: {code: 603, message: "This username is not in our database"},
        ERROR_CARD_EXITS: {code: 604, message: "A card with this number already exists"},
        ERROR_ACCESS_REQUIRED: {code: 605, message: "You do not have the privilege to perform this action."},
        ERROR_INVALID_RATE: {code: 606, message: "Field 'rate' must be between 1 and 5"},
        ERROR_COUPON_NOT_FOUND: {code: 607, message: "The coupon you entered is not valid."},
        INVALID_PASSWORD: {code: 608, message: "Invalid password"},
        ERROR_ALREADY_IN_TRAVEL: {code: 609, message: "You have a race in progress."},
        ERROR_PHONE_NOT_FOUND: {code: 610, message: "Invalid code! The cell could not be registered."},
        ERROR_INVALID_DATE: {code: 611, message: "Invalid date."},
        ERROR_CARD_NOT_FOUND: {code: 612, message: "Card not found."},
        ERROR_COUPON_ALREADY_USED: {code: 613, message: "Coupon Already Used."},
        ERROR_INVALID_CATEGORY: {code: 614, message: "This request is not yet available."},
        ERROR_GENDER_PERMISSION: {code: 615, message: "Service available only from women to women."},
        ERROR_EXISTS_CPF: "This CPF is already being used",
        ERROR_FLOW: {code: 616, message: "Service available only to offline drivers."},
        ERROR_APPROVAL: {code: 617, message: "There are still documents from this user that need to be approved."},
        ERROR_NO_DRIVERS: {code: 618, message: "There are no drivers available in the region."},
        ERROR_INVALID_BRAND: {code: 619, message: "Invalid card flag."},
        ERROR_INVALID_PHONE: {code: 620, message: "Invalid phone number."},
        ERROR_INVALID_TRAVEL: {
            code: 621,
            message: "The trip has already been accepted by someone or canceled by the passenger."
        },
        ERROR_INVALID_PLATE: {code: 622, message: "Ops! Invalid badge number."},
        ERROR_INVALID_CARD: {code: 623, message: "Ops! Invalid card."},
        ERROR_INVALID_BANK_ACCOUNT: {code: 624, message: "Oops, you have not registered any bank account yet."},
        TEMPORARY_UNAVAILABLE: {code: 625, message: "Ops! temporary unavailable."},
        ERROR_OBJECT_NOT_FOUND: {code: 625, message: "Oops! Object not found in database."},
        ERROR_UNAVAILABLE_WITHDRAW: {code: 626, message: "Oops! Take unavailable."},
        ERROR_PLAN_STILL_AVAILABLE: {code: 627, message: "Your current plan has not yet expired!"},
        ERROR_DRIVER_ALREADY: {code: 628, message: "Another driver has already accepted this race."},
        ERROR_INACTIVE_USER: {code: 629, message: "User disabled"},
        ERROR_REFUSED: {code: 630, message: "Transaction denied"},
        ERROR_CARD_INVALID: {code: 631, message: "This card could not be registered."},
        ERROR_YEAR_INVALID: {code: 632, message: "The car year entered is not compatible with this category."},
        ERROR_INSTALLMENTS_INVALID: {code: 633, message: "The number of parcels must be between 1 and 12"},
        ERROR_INSTALLMENTS_MAX: {code: 634, message: "The number of parcels is invalid."},
        ERROR_SAME_USER: {code: 635, message: "Can not accept the request itself."},
        ERROR_FARE_EXISTS: {code: 636, message: "There is already an active rate for this category."},
        ERROR_INDICATION_NOT_EXISTS: {code: 637, message: "The indication code does not exist"},
        ERROR_CODE_EXISTS: {code: 638, message: "Indicator code is already used by another user"},
        ERROR_WRONG_APP: {code: 605, message: "You are registered as {{type}}, use the appropriate application."},
        ERROR_CPF_INVALID: {code: 639, message: "The CPF entered is invalid."},
        ERROR_EMAIL_INVALID: {code: 640, message: "The email is not in our records."},
        ERROR_RADIUS_EXISTS: {code: 641, message: "There is already a distance limit for this location."},
        ERROR_RADIUS_WITHOUT_STATE: {
            code: 642,
            message: "It is not possible to create a distance without defining the state."
        },
        ERROR_INDICATION_PASSENGER_TO_DRIVER: {
            code: 643,
            message: "It is not possible to register as a driver using a passenger code."
        },
        ERROR_FARE_IN_USE: {code: 644, message: "This fare is being used on some travel!"},
        ERROR_MIN_WITHDRAW: {code: 645, message: "Small value to perform withdrawal."},
        ERROR_EDIT_DURATION_OF_PLAN: {code: 646, message: "Can not edit the duration of a plan."},
        ERROR_EDIT_VALUE_OF_PLAN: {code: 647, message: "Can not edit the value of a plan."},
        ERROR_LOCATION_FORBIDDEN: {
            code: 648,
            message: "We are not yet operating in this region. Contact us for more information."
        },
        ERROR_LOCATION_NOT_FOUN: {
            code: 696,
            message: "Ops, unfortunaly we couldn't find your current location, please try to inform it manualy."
        },
        ERROR_FEE_IN_USER: {code: 649, message: "It is not possible to delete an application fee that has a history."},
        ERROR_USER_BLOCKED: {
            code: 650,
            message: "Your username is blocked. Contact management for more details."
        },
        ERROR_COUPON_LIMIT: {code: 651, message: "Oops! This coupon is no longer valid."},
        ERROR_ERASE_INVALID: {code: 652, message: "Oops! The value entered must be 0 and total debt."},
        ERROR_GPS_INVALID: {
            code: 653,
            message: "Unable to get your current location, please check if GPS is enabled."
        },
        ERROR_TIME_ALREADY_USED_IN_FARE: {
            code: 654,
            message: "Oops! There is already an active rate for this time interval."
        },
        ERROR_ERROR_TO_TRACE_ROUTE: {
            code: 655,
            message: "Oops! It was not possible to trace a route between the selected points."
        },
        ERROR_CARD_LIMIT: {code: 656, message: "Oops! You can not add more than 5 cards."},
        ERROR_BLOCK_CARD_CREATION: {
            code: 657,
            message: "Oops! At the moment it is not possible to register credit cards."
        },
        ERROR_CODE_ALREADY_EXISTS: {code: 658, message: "Oops! This code is already being used by another user."},
        ERROR_NOT_IS_DRIVER: {code: 659, message: "The user must be a driver."},
        ERROR_NO_BONUS_TO_USE: {
            code: 660,
            message: "Oops! You do not have enough bonuses to request this trip."
        },
        ERROR_PLATE_EXISTS: {code: 691, message: "Oops! There is already a vehicle registered with this board."},
        //Pagarme
        ERROR_OLD_VERSION: {
            code: 662,
            message: "Oops! Your app is out of date. Please download the latest version to continue using the services."
        },
        ERROR_MAX_LEN_CODE: {code: 663, message: "The maximum length of the referral code is 25 characters."},
        ERROR_MAX_COUPON_PER_USER: {code: 664, message: "You have reached the usage limit for this coupon."},
        ERROR_INVALID_FIELDS_ALLOW: {code: 665, message: "The allows field is in invalid format."},
        ERROR_CATEGORY_IN_USE: {code: 666, message: "Some users are using this category."},
        ERROR_OWNER_VEHICLE: {code: 667, message: "Vehicle belongs to another user."},
        ERROR_CATEGORY_VEHICLE: {code: 668, message: "No categories linked to this vehicle."},
        ERROR_APPROVE_VEHICLE: {code: 669, message: "This vehicle has already been approved."},
        ERROR_PRIMARY_VEHICLE: {code: 670, message: "This vehicle is being used as the main vehicle."},
        ERROR_DOCUMENT_VEHICLE: {code: 671, message: "No documents linked to this vehicle."},
        ERROR_VEHICLE_ALREADY_PRIMARY: {code: 672, message: "This vehicle is already registered as a main vehicle."},
        ERROR_VEHICLE_WAITING_APPROVAL: {code: 673, message: "This vehicle is not yet approved."},
        ERROR_NEED_PRIMARY_VEHICLE: {
            code: 674,
            message: "To exclude this vehicle you must have at least one other approved vehicle."
        },
        ERROR_TYPE_EMAIL: {code: 675, message: "Invalid type email."},
        ERROR_BILLEI_PENDING: {code: 676, message: "There is already a ticket waiting for payment for this user."},
        ERROR_LONG_NAME_BANK_ACCOUNT: {code: 677, message: "Bank account owner name must be 30 characters or less."},
        ERROR_VEHICLE_ALREADY_CATEGORY: {code: 678, message: "This vehicle is already in this category."},
        ERROR_CATEGORY_BILINGUAL_REQUIRED: {
            code: 679,
            message: "Description field must also be sent in another language."
        },
        ERROR_DRIVER_WITHOUT_VEHICLE: {
            code: 680,
            message: "It is not possible to create bank account for a driver without vehicle."
        },
        ERROR_STATE_NOT_FOUND: {code: 681, message: "State not found."},
        ERROR_REQUIRED_ENROLLMENT: {code: 682, message: "The field enrollment is required."},
        ERROR_EXISTS_ENROLLMENT: {code: 683, message: "There is already a registered passenger with this enrollment."},
        ERROR_NO_FEATURE_SUPPORT: {code: 698, message: "This feature is not enabled."},
        ERROR_GRADUATION_IN_USE: {
            code: 699,
            message: "The graduation can't be removed because is related to one or more users."
        },
        ERROR_DRIVER_IN_TRAVEL_LOGIN_PASSENGER: {code: 701, message: "User finds himself on a trip as a driver."},
        ERROR_DATE_SCHEDULE_TRAVEL: {code: 702, message: "Invalid date"},
        ERROR_AVAILABLE_SCHEDULE_TRAVEL: {
            code: 703,
            message: "The time entered belongs to a range of another schedule. Check and try again."
        },
        ERROR_NOT_SCHEDULE_TRAVEL: {code: 704, message: "This is not a scheduled travel."},
        ERROR_MIN_FOR_WITHDRAW: {code: 705, message: "The minimum withdrawal amount is R$ 5.00"},
        ERROR_METHOD_NOT_IMPLEMENTED: {code: 702, message: "Method not implemented"},
        ERROR_VALUE_NOT_VALID: {code: 191, message: "THE VALUE IS INVALID"},
        INVALID_PAYMENT: {code: 699, message: "The selected payments is not available."},
        BLOCKED_WITHDRAW: {code: 197, message: "Wasn't possible to complete this operation."},
        INVALID_TRAVEL_ID: {code: 719, message: "Ops, something went wrong, verify your internet connection."},
        ERROR_MISS_DOCDATA: {
            code: 720,
            message: "You must add a due date to all documents where the due date is checked."
        },
        ERROR_PAGARME: {code: 700},
        ERROR_SEND_LINKBACK: {code: 707, message: "Send the back of the document"},
        ERROR_SEND_DOCUMENT: {code: 708, message: "Fill in the required fields"},
        ERROR_LENGTH_NAME: {code: 709, message: "Name must be at most 30 characters."},
        ERROR_INSUFICIENT_BALANCE: {code: 961, message: "Ops, insuficiente balance!"},

        ERROR_LOCATION_OR_PLACEID: {code: 709, message: "The sent field location or placeId is required"},
        INVALID_POINT: {code: 720, message: "Ops, invalid stop."},
        ERROR_UNIQUE_RATE_TRAVEL: {code: 723, message: "You already rated this travel."},
        ERROR_CODE_NOT_FOUND: {code: 607, message: "The indication code entered is not valid."},
        ERROR_NO_DRIVERS_CALL_AGAIN: {code: 726, message: "Redirected race canceled or refused by drivers."},
        ERROR_INVALID_FIELDS_FORMAT: {code: 725, message: "Some input field has an invalid format."},
        ERROR_DOCUMENT_IN_USE: {code: 727, message: "Some user is using this document."},
        ERROR_INTERNAL_SERVER_ERROR: { code: 500, message: "Internal server error. Contact the system admin." },
        FAIL_TO_APPROVE_DRIVER_BY_ENROLLMENT: {code: 729, message: "Driver could not be approved! It does not have a member number."},
    },
    receipt: {
        file_html: "receipt_en",
        typePayment: "CASH",
        currency: "$",
        default: {
            travelValue: "TRAVEL VALUE",
            fees: "FEES",
            cancellationFee: "CANCELLATION FEE",
            valueStoppedDriver: "DRIVER WAITING RATE",
            couponValue: "PAID WITH COUPON",
            paidWithBonus: "PAID WITH BONUS",
            totalValue: "TOTAL AMOUNT",
            driverCredit: "DRIVER CREDIT",
            driverReceive: "YOU RECEIVE"
        },
        flipmob: {
            fees: "FIXED COST:",
        },
        yesgo: {
            totalValue: "TOTAL TRAVEL AMOUNT:",
            driverCredit: "CREDIT GENERATED WITH COUPON:",
            driverReceive: "YOU GET IN CASH:",
            driverReceiveBonus: "YOU GET IN CASHBACK: "
        }
    },
    paymentMethod: {
        cash: "Cash",
        card: "Card",
        bonus: "Bonus",
        coupon: "Coupon",
        cashAndBonus: "Cash + Bonus"
    },
    profileInfo: "User since {{month}} {{day}}, {{year}}",
    formatErros: function (user, error) {
        error = error || user;
        switch (error.code) {
            case 101:
                return "Ops! Object not found";
            case 200:
            case 201:
            case 203:
                return "Email or password are blank, please submit the fields correctly.";
            case 1:
            case 2:
            case 4:
                // case 141:
                return "Oops, our servers get confused, try again later.";
            case 202:
                return "This email is already being used.";
            default:
                return error.message;
        }
    }
};

module.exports = Messages;
