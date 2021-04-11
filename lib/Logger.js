const utils = require("./Utils.js");
const conf = require("config");
const Define = require('./Define.js');
const Messages = require('./Locales/Messages.js');
const listFields = ["errors", "planClass", "objOld", "couponClass", "action", "categoryClass", "idClass", "travelClass", "updatedAt", "createdAt", "objectId"];
const listRequiredFields = [];
const response = require('./response');
function Logger(request) {
    const _request = request;
    const _response = response;
    const _currentUser = request ? request.user : null;
    const _params = request ? request.params : null;
    const _language = _currentUser ? _currentUser.get("language") : null;
    const _super = {
        actions: {
            DELETE_DOCUMENT: "deleteDocument",
            BLOCK_USER: "blockUser",
            UNBLOCK_USER: "unblockUser",
            APPROVE_USER: "approveUser",
            REPROVE_USER: "reproveUser",
            DELETE_USER: "deleteUser",
            CHANGE_INDEBT_USER: "inDebtUser",
            EDIT_USER: "editUser",
            SET_AS_ADMIN: "setAsAdmin",
            REMOVE_AS_ADMIN: "removeAsAdmin",
            EDIT_VEHICLE: "editVehicle",
            DELETE_TRAVEL: "deleteTravel",
            CANCEL_TRAVEL_BY_ADMIN: "cancelTravelByAdmin",
            COMPLETE_TRAVEL_AS_ADMIN: "completeTravelAsAdmin",
            CREATE_PLAN: "createPlan",
            EDIT_PLAN: "editPlan",
            CREATE_FARE: "createFare",
            CREATE_CANCELLATION: "createCancellation",
            EDIT_FARE: "editFare",
            ACTIVATE_FARE: "activateFare",
            DEACTIVATE_FARE: "deactivateFare",
            CREATE_COUPON: "createCoupon",
            EDIT_COUPON: "editCoupon",
            DELETE_COUPON: "deleteCoupon",
            CREATE_CATEGORY: "createCategory",
            CREATE_CARD: "createCard",
            EDIT_CATEGORY: "editCategory",
            DELETE_CATEGORY: "deleteCategory",
            ACTIVATE_CATEGORY: "activateCategory",
            DEACTIVATE_CATEGORY: "deactivateCategory",
            UPDATE_BANKACCOUNT: "updatebankaccount",
        },
        createLog: async (action, section, admin, id, fieldClass, fieldBody, message, objClass, oldInfo, newInfo, errors) => {
            try {
                if (admin) {
                    const aux = new Parse.User();
                    aux.set("objectId", admin);
                    admin = aux;
                }
                const logger = new Define.Logger();
                logger.set("admin", admin);
                logger.set("action", action);
                logger.set("section", section);
                if (fieldClass && fieldBody) {
                    logger.set(fieldClass, fieldBody);
                }
                logger.set("idClass", id);
                logger.set("message", message);
                logger.set("objClass", objClass);
                if (errors)
                    logger.set("errors", errors);
                if (oldInfo && newInfo) {
                    let {objOld, objNew} = _super.compareObjects(oldInfo, newInfo);
                    logger.set("objOld", objOld);
                    logger.set("objNew", objNew);
                } else if (oldInfo) {
                    logger.set("objOld", oldInfo);
                } else if (newInfo) {
                    logger.set("objNew", newInfo);
                }
                return logger.save();
            } catch (error) {
                console.log(error.message);
            }
        },
        compareObjects: (objOld, objNew) => {
            let objLargest = Object.keys(objOld).length > Object.keys(objNew).length ? objOld : objNew;
            for (let key in objLargest) {
                if (Array.isArray(objOld[key]) && Array.isArray(objNew[key]) && objOld[key].length && objOld[key].length === objNew[key].length) {
                    delete objOld[key];
                    delete objNew[key];
                } else if (objOld[key] && objOld[key].iso && objNew[key].iso && new Date(objOld[key].iso).getTime() === new Date(objNew[key].iso).getTime()) {
                    delete objOld[key];
                    delete objNew[key];
                } else if (objOld[key] && objOld[key].__type && objNew[key] && objNew[key].__type) {
                    if (objOld[key].__type === "GeoPoint" && objNew[key].__type === "GeoPoint" && objOld[key].latitude === objNew[key].latitude && objOld[key].longitude === objNew[key].longitude) {
                        delete objOld[key];
                        delete objNew[key];
                    } else if (objOld[key].__type === "Pointer" && objNew[key].__type === "Pointer" && objOld[key].objectId === objNew[key].objectId) {
                        delete objOld[key];
                        delete objNew[key];
                    }
                } else if (objOld[key] == objNew[key]) {
                    delete objOld[key];
                    delete objNew[key];
                }
            }


            delete objNew.ACL;
            delete objOld.ACL;
            delete objNew.createdAt;
            delete objOld.createdAt;
            delete objNew.updatedAt;
            delete objOld.updatedAt;
            return {objOld, objNew};
        },

        /* DOCUMENT */
        logDeleteDocument: function (id, data) {
            const message = "Documento deletado pelo administrador.";
            return _super.createLog(_super.actions.DELETE_DOCUMENT, "document", data.admin, id, null, null, message, "Document", data.oldInfo);
        },

        /* USER */
        logBlockUser: function (id, data) {
            const message = "Usuário foi bloqueado.";
            const user = new Parse.User();
            user.set("objectId", id);
            return _super.createLog(_super.actions.BLOCK_USER, "user", data.admin, id, "userClass", user, message, "_User");
        },
        logUnblockUser: function (id, data) {
            const message = "Usuário foi desbloqueado.";
            const user = new Parse.User();
            user.set("objectId", id);
            return _super.createLog(_super.actions.UNBLOCK_USER, "user", data.admin, id, "userClass", user, message, "_User");
        },
        logApproveUser: function (id, data) {
            const message = "Motorista foi aprovado.";
            const user = new Parse.User();
            user.set("objectId", id);
            return _super.createLog(_super.actions.APPROVE_USER, "user", data.admin, id, "userClass", user, message, "_User");
        },
        logReproveUser: function (id, data) {
            const message = "Motorista foi reprovado.";
            const user = new Parse.User();
            user.set("objectId", id);
            return _super.createLog(_super.actions.REPROVE_USER, "user", data.admin, id, "userClass", user, message, "_User");
        },
        logDeleteUser: async (id, data) => {
            const message = "Usuário foi excluido.";
            return _super.createLog(_super.actions.DELETE_USER, "user", data.admin, id, null, null, message, "_User", data);
        },
        logChangeInDebt: async (id, data) => {
            const message = "Saldo devedor alterado.";
            const user = new Parse.User();
            user.set("objectId", id);
            return _super.createLog(_super.actions.CHANGE_INDEBT_USER, "user", data.admin, id, "userClass", user, message, "_User", {value: data.value}, {value: data.oldDebt});
        },
        logEditUser: function (id, data) {
            const message = "Usuário foi atualizado.";
            const user = new Parse.User();
            user.set("objectId", id);
            return _super.createLog(_super.actions.EDIT_USER, "user", data.admin, id, "userClass", user, message, "_User", data.oldInfo, data.newInfo);
        },
        logSetAsAdmin: function (id, data) {
            const message = "Alterando permissão de um usuário";
            const user = new Parse.User();
            user.set("objectId", id);
            return _super.createLog(_super.actions.SET_AS_ADMIN, "user", data.admin, id, "userClass", user, message, "_User", data.oldInfo, data.newInfo);
        },
        logRemoveAsAdmin: function (id, data) {
            const message = "Removendo permissão de um usuário";
            const user = new Parse.User();
            user.set("objectId", id);
            return _super.createLog(_super.actions.REMOVE_AS_ADMIN, "user", data.admin, id, "userClass", user, message, "_User", data.oldInfo, data.newInfo);
        },

        /* VEHICLE */
        logEditVehicle: function (id, data) {
            const message = "Veículo foi atualizado.";
            const vehicle = new Define.Vehicle();
            vehicle.set("objectId", id);
            return _super.createLog(_super.actions.EDIT_VEHICLE, "user", data.admin, id, "vehicleClass", vehicle, message, "Vehicle", data.oldInfo, data.newInfo);
        },
        /* BANK ACCOUNT... */
        logBankAccount: function (id, data) {
            const message = "Conta bancária atualizada.";
            const bank = new Define.BankAccount;
            bank.set("objectId", id);
            return _super.createLog(_super.actions.UPDATE_BANKACCOUNT, "user", data.admin, id, "bankClass", bank, message, "BankAccount", data.oldInfo, data.newInfo);
        },
        /* TRAVEL */
        logDeleteTravel: function (id, data) {
            const message = "Viagem foi excluída.";
            const travel = new Define.Travel();
            travel.set("objectId", id);
            return _super.createLog(_super.actions.DELETE_TRAVEL, "travel", data.admin, id, "travelClass", travel, message, "Travel", data.oldInfo, data.newInfo);
        },
        logCancelTravelByAdmin: function (id, data) {
            const message = "Viagem cancelada pelo administrador.";
            const travel = new Define.Travel();
            travel.set("objectId", id);
            return _super.createLog(_super.actions.CANCEL_TRAVEL_BY_ADMIN, "travel", data.admin, id, "travelClass", travel, message, "Travel", data.oldInfo, data.newInfo);
        },
        logCompleteTravelAsAdmin: function (id, data) {
            const message = "Viagem completada pelo administrador.";
            const travel = new Define.Travel();
            travel.set("objectId", id);
            return _super.createLog(_super.actions.COMPLETE_TRAVEL_AS_ADMIN, "travel", data.admin, id, "travelClass", travel, message, "Travel", data.oldInfo, data.newInfo);
        },
        /* PLAN */
        logCreatePlan: function (id, data) {
            const message = "Novo plano criado pelo administrador.";
            const plan = new Define.Plan();
            plan.set("objectId", id);
            return _super.createLog(_super.actions.CREATE_PLAN, "plan", data.admin, id, "planClass", plan, message, "Plan", data.oldInfo, data.newInfo);
        },
        logEditPlan: function (id, data) {
            const message = "Plano editado pelo administrador.";
            const plan = new Define.Plan();
            plan.set("objectId", id);
            return _super.createLog(_super.actions.EDIT_PLAN, "plan", data.admin, id, "planClass", plan, message, "Plan", data.oldInfo, data.newInfo);
        },
        /* CANCELLATION */
        logCreateCancellation: function (id, data) {
            const message = "Motivo de cancelamento criado pelo administrador.";
            const cancel = new Define.Cancellation();
            cancel.set("objectId", id);
            return _super.createLog(_super.actions.CREATE_CANCELLATION, "cancellation", data.admin, id, "cancellationClass", cancel, message, "Cancellation", data.oldInfo, data.newInfo);
        },
        /* FARE */
        logCreateFare: function (id, data) {
            const message = "Tarifa criado pelo administrador.";
            const fare = new Define.Fare();
            fare.set("objectId", id);
            return _super.createLog(_super.actions.CREATE_FARE, "fare", data.admin, id, "fareClass", fare, message, "Fare", data.oldInfo, data.newInfo);
        },
        logEditFare: function (id, data) {
            const message = "Tarifa editada pelo administrador.";
            const fare = new Define.Fare();
            fare.set("objectId", id);
            return _super.createLog(_super.actions.EDIT_FARE, "fare", data.admin, id, "fareClass", fare, message, "Fare", data.oldInfo, data.newInfo);
        },
        logActivateFare: function (id, data) {
            const message = "Tarifa ativada pelo administrador.";
            const fare = new Define.Fare();
            fare.set("objectId", id);
            return _super.createLog(_super.actions.ACTIVATE_FARE, "fare", data.admin, id, "fareClass", fare, message, "Fare", data.oldInfo, data.newInfo);
        },
        logDeactivateFare: function (id, data) {
            const message = "Tarifa desativada pelo administrador.";
            const fare = new Define.Fare();
            fare.set("objectId", id);
            return _super.createLog(_super.actions.DEACTIVATE_FARE, "fare", data.admin, id, "fareClass", fare, message, "Fare", data.oldInfo, data.newInfo);
        },
        /* COUPON */
        logCreateCoupon: function (id, data) {
            const message = "Novo cupom criado pelo administrador.";
            const coupon = new Define.Coupon();
            coupon.set("objectId", id);
            return _super.createLog(_super.actions.CREATE_COUPON, "coupon", data.admin, id, "couponClass", coupon, message, "Coupon", data.oldInfo, data.newInfo);
        },
        logEditCoupon: function (id, data) {
            const message = "Cupom alterado pelo administrador.";
            const coupon = new Define.Coupon();
            coupon.set("objectId", id);
            return _super.createLog(_super.actions.EDIT_COUPON, "coupon", data.admin, id, "couponClass", coupon, message, "Coupon", data.oldInfo, data.newInfo);
        },
        logDeleteCoupon: function (id, data) {
            const message = "Cupom deletado pelo administrador.";
            // const coupon = new Define.Coupon();
            // coupon.set("objectId", id);
            return _super.createLog(_super.actions.DELETE_COUPON, "coupon", data.admin, id, null, null, message, "Coupon", data.oldInfo, data.newInfo);
        },
        /* CATEGORY */
        logCreateCategory: function (id, data) {
            const message = "Nova categoria criada pelo administrador.";
            const category = new Define.Category();
            category.set("objectId", id);
            return _super.createLog(_super.actions.CREATE_CATEGORY, "category", data.admin, id, "categoryClass", category, message, "Category", data.oldInfo, data.newInfo);
        },
        logEditCategory: function (id, data) {
            const message = "Categoria editada pelo administrador.";
            const category = new Define.Category();
            category.set("objectId", id);
            return _super.createLog(_super.actions.EDIT_CATEGORY, "category", data.admin, id, "categoryClass", category, message, "Category", data.oldInfo, data.newInfo);
        },
        logDeleteCategory: function (id, data) {
            const message = "Categoria deletada pelo administrador.";
            // const category = new Define.Category();
            // category.set("objectId", id);
            return _super.createLog(_super.actions.DELETE_CATEGORY, "category", data.admin, id, null, null, message, "Category", data.oldInfo, data.newInfo);
        },
        logActivateCategory: function (id, data) {
            const message = "Categoria ativada pelo administrador.";
            const category = new Define.Category();
            category.set("objectId", id);
            return _super.createLog(_super.actions.ACTIVATE_CATEGORY, "category", data.admin, id, "categoryClass", category, message, "Category", data.oldInfo, data.newInfo);
        },
        logDeactivateCategory: (id, data) => {
            const message = "Categoria desativada pelo administrador.";
            const category = new Define.Category();
            category.set("objectId", id);
            return _super.createLog(_super.actions.DEACTIVATE_CATEGORY, "category", data.admin, id, "categoryClass", category, message, "Category", data.oldInfo, data.newInfo);
        },

        /* CARD */
        logFailCreateCard: async (id, data) => {
            try {
                let query = new Parse.Query(Parse.User);
                query.equalTo("paymentId", id);
                const user = await query.first();
                const userId = user.id;
                const message = "Falha ao tentar cadastrar cartão de crédito.";
                const errors = JSON.parse(data.errors);
                return _super.createLog(_super.actions.CREATE_CARD, "user", undefined, userId, "userClass", user, message, "_User", null, null, errors);

            } catch (e) {
                return Promise.resolve();
            }
        },
        formatLogger: (log) => {
            let userClass = log.get("userClass") || false;
            let admin = log.get("admin") || false;
            let out = {
                section: log.get("section") || null,
                message: log.get("message") || null,
                oldInfo: log.get("objOld") || null,
                newInfo: log.get("objNew") || null,
                objClass: log.get("objClass") || null,
                idClass: log.get("idClass") || null,
                createdAt: log.get("createdAt") || null,
                user: userClass ? {
                    name: userClass.get("name") || null,
                    isPassenger: userClass.get("isPassenger") || null,
                    isDriver: userClass.get("isDriver") || null,
                    objectId: userClass.id
                } : undefined,
                admin: admin ? {
                    name: admin.get("name") || null,
                    objectId: admin.id
                } : undefined,
                objectId: log.id
            };
            let permitedKeys = ['name', 'fullName', 'Genero', 'phone', 'birthDate', 'planActive', 'profileImage', 'gender', 'cpf', 'city'];
            // if (out.oldInfo && out.newInfo) {
            //     for (let i = 0; i < (Object.keys(out.oldInfo).length > Object.keys(out.newInfo).length ? Object.keys(out.oldInfo).length : Object.keys(out.newInfo).length); i++) {
            //         if (!(Object.keys(out.oldInfo)[i] && permitedKeys.indexOf(Object.keys(out.oldInfo)[i]) >= 0)) {
            //             // delete out.oldInfo[Object.keys(out.oldInfo)[i]];
            //         }
            //         if (!(Object.keys(out.newInfo)[i] && permitedKeys.indexOf(Object.keys(out.newInfo)[i]) >= 0)) {
            //             delete out.newInfo[Object.keys(out.newInfo)[i]];
            //         }
            //     }
            // }
            return out;
        },
        publicMethods: {
            listLogs: {
                f: async () => {
                    try {
                        let {userId, limit, page} = _params, data = [];
                        let query = new Parse.Query(Define.Logger);
                        let user = userId ? await utils.getObjectById(userId, Parse.User) : false;
                        if (user) query.equalTo("userClass", user);
                        let total = await query.count();
                        limit = limit || 2000;
                        page = ((page && page > 0) ? page - 1 : page || 0) * limit;
                        query.include(["userClass", "admin"]);
                        query.limit(limit);
                        query.skip(page);
                        query.descending('createdAt');
                        let logs = await query.find();
                        for (let i in logs)
                            data.push(_super.formatLogger(logs[i]));
                      return _response.success({total: total, logs: data})
                    } catch (e) {
                        _response.error(e.code, e.message);
                    }
                },
                access: ["admin"],
                required: [],
            }
        }
    };
    return _super;
}

exports.instance = Logger;

for (let key in Logger().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        const method = Logger(request).publicMethods[request.functionName];
        if (utils.verifyRequiredFields(request.params, method.required, response) &&
            ((!method.access || method.access.length === 0) || utils.verifyAccessAuth(request.user, method.access, response))) {
            try {
                return await method.f();
            } catch (e) {
                response.error(e.code, e.message);
            }
        } else {
            response.error(Messages().error.ERROR_UNAUTHORIZED);
        }
    });
}
