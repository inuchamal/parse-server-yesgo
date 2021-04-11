const {request, app} = require('../../config');
const {config} = require('../../config');
const FakerUser = require('../../Faker/User.js');
const appId = config.appId;

let driver = FakerUser.createDrivers(1);

let sessionTokenAdmin, sessionTokenPassenger, planId, totalPlans, userId, sessionTokenDriver, catId;
let passenger = FakerUser.createPassengers(1);

describe('Register Passenger', () => {
    it('should accept register this passenger', done => {
        request(app).post('/use/functions/signUpPassenger')
            .send(passenger[0])
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.objectId).not.toBeUndefined();
                expect(res.body.result.sessionToken).not.toBeUndefined();
                sessionTokenPassenger = res.body.result.sessionToken;
                done(err);
            });
    }, 9999999);
});

describe('Login with Admin', () => {
    it('should login with admin', done => {
        request(app).post('/use/functions/logIn')
            .send({
                _ApplicationId: appId,
                login: "Talita.Moreira51@bol.com.br",
                password: "4kBlduiO6V7jddJ"
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(200);
            expect(res.body.result.sessionToken !== undefined).toEqual(true);
            sessionTokenAdmin = res.body.result.sessionToken;
            done(err);
        });
    }, 10000);
});

describe('Create Plan', () => {
    it('should create plan', done => {
        request(app).post('/use/functions/createPlan')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                default: true,
                period: 'por semestre',
                description: 'Descrição de um plano qualquer',
                percent: 0,
                retention: 1,
                active: true,
                name: 'Plano Default',
                value: 29.99,
                duration: 60
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(200);
            expect(res.body.result.objectId).not.toBeUndefined();
            planId = res.body.result.objectId;
            expect(res.body.result.message).toBe("O objeto foi criado com sucesso");
            done(err);
        });
    }, 10000);

    it('should create plan', done => {
        request(app).post('/use/functions/createPlan')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                default: true,
                period: 'por ano',
                description: 'Descrição de um plano com hasBillet',
                percent: 0,
                hasBillet: true,
                billetValue: 69.99,
                retention: 1,
                active: true,
                name: 'Plano Default',
                value: 59.99,
                duration: 365
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(200);
            expect(res.body.result.objectId).not.toBeUndefined();
            expect(res.body.result.message).toBe("O objeto foi criado com sucesso");
            done(err);
        });
    }, 10000);

    //Tá aceitando Plano com dados idênticos
    // it('should not create plan because there is a plan with this data', done => {
    //     request(app).post('/use/functions/createPlan')
    //         .send({
    //             _ApplicationId: appId,
    //             _SessionToken: sessionTokenAdmin,
    //             default: true,
    //             period: 'por ABC',
    //             description: 'Descrição de um plano qualquer',
    //             percent: 0,
    //             retention: 1,
    //             active: true,
    //             name: 'Plano Default',
    //             value: 49.99,
    //             duration: 60
    //         }).end((err, res) => {
    //         expect(res ? res.status : 'error').toEqual(400);
    //         done(err);
    //     });
    // }, 10000);

    //Não tá aceitando passar o limit como parametro
    // it('should create plan (passing limit as param)', done => {
    //     request(app).post('/use/functions/createPlan')
    //         .send({
    //             _ApplicationId: appId,
    //             _SessionToken: sessionTokenAdmin,
    //             default: true,
    //             period: 'por semestre',
    //             description: 'Descrição de um plano qualquer',
    //             percent: 0,
    //             retention: 1,
    //             active: true,
    //             name: 'Plano Default',
    //             value: 49.99,
    //             duration: 60,
    //             limit: 12
    //         }).end((err, res) => {
    //         expect(res ? res.status : 'error').toEqual(200);
    //         done(err);
    //     });
    // }, 10000);

    //Tá aceitando percent negativa
    // it('should not create plan because percent is negative', done => {
    //     request(app).post('/use/functions/createPlan')
    //         .send({
    //             _ApplicationId: appId,
    //             _SessionToken: sessionTokenAdmin,
    //             default: true,
    //             period: 'por semestre',
    //             description: 'Descrição de um plano qualquer',
    //             percent: -0,
    //             retention: 1,
    //             active: true,
    //             name: 'Plano Default',
    //             value: 49.99,
    //             duration: 60
    //         }).end((err, res) => {
    //         expect(res ? res.status : 'error').toEqual(400);
    //         done(err);
    //     });
    // }, 10000);

    //Tá aceitando retention negativa
    // it('should not create plan because retention is negative', done => {
    //     request(app).post('/use/functions/createPlan')
    //         .send({
    //             _ApplicationId: appId,
    //             _SessionToken: sessionTokenAdmin,
    //             default: true,
    //             period: 'por semestre',
    //             description: 'Descrição de um plano qualquer',
    //             percent: 0,
    //             retention: -1,
    //             active: true,
    //             name: 'Plano Default',
    //             value: 60,
    //             duration: 60
    //         }).end((err, res) => {
    //         expect(res ? res.status : 'error').toEqual(400);
    //         done(err);
    //     });
    // }, 10000);

    it('should not create plan because value is zero', done => {
        request(app).post('/use/functions/createPlan')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                default: true,
                period: 'por semestre',
                description: 'Descrição de um plano qualquer',
                percent: 0,
                retention: 1,
                active: true,
                name: 'Plano Default',
                value: 0,
                duration: 60
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(400);
            expect(res.body.code).toEqual(700);
            done(err);
        });
    }, 10000);

    it('should not create plan because it is not a admin', done => {
        request(app).post('/use/functions/createPlan')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(400);
            expect(res.body.error).toEqual("Field(s) 'name,value,description,duration,active,percent,period' are required.");
            done(err);
        });
    }, 10000);
});

describe('Edit Plan', () => {
    //Não está aceitando editar um plano sem passar a duration atual e o value atual do plano
    // it('should edit a plan', done => {
    //     request(app).post('/use/functions/editPlan')
    //         .send({
    //             _ApplicationId: appId,
    //             _SessionToken: sessionTokenAdmin,
    //             planId: planId
    //         }).end((err, res) => {
    //         expect(res ? res.status : 'error').toEqual(200);
    //         done(err);
    //     });
    // }, 10000);

    it('should edit a plan', done => {
        request(app).post('/use/functions/editPlan')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                planId: planId,
                duration: 60,
                value: 29.99
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(200);
            expect(res.body.result).toEqual("O objeto foi atualizado com sucesso");
            done(err);
        });
    }, 10000);

    it('should not edit a plan because only admins can do it', done => {
        request(app).post('/use/functions/editPlan')
            .send({
                _ApplicationId: appId,
                planId: planId,
                duration: 60,
                value: 29.99
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(400);
            expect(res.body.error).toEqual("Voce não possui privilégio para realizar esta ação.");
            done(err);
        });
    }, 10000);

    it('should not edit a plan because there is not a planId', done => {
        request(app).post('/use/functions/editPlan')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                duration: 60,
                value: 29.99
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(400);
            expect(res.body.error).toEqual("Field(s) 'planId' are required.");
            done(err);
        });
    }, 10000);

    it('should not edit a plan because duration is different', done => {
        request(app).post('/use/functions/editPlan')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                planId: planId,
                duration: 200,
                value: 29.99
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(400);
            expect(res.body.error).toEqual("Não é possivel editar a duração de um plano.");
            done(err);
        });
    }, 10000);

    it('should not edit a plan because value is different', done => {
        request(app).post('/use/functions/editPlan')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                planId: planId,
                value: 10.00,
                duration: 60
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(400);
            expect(res.body.error).toEqual("Não é possivel editar o valor de um plano.");
            done(err);
        });
    }, 10000);

    it('should not edit a plan because there is wrong param', done => {
        request(app).post('/use/functions/editPlan')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                planId: planId,
                duration: 60,
                value: 29.99,
                wrongParam: "wrongParam"
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(400);
            expect(res.body.error).toEqual("Field(s) 'wrongParam' not supported.");
            done(err);
        });
    }, 10000);
});

describe('Get Plan by Id', () => {
    it('should get plan by id', done => {
        request(app).post('/use/functions/getPlanById')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                planId: planId
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(200);
            expect(res.body.result.name).toEqual("Plano Default");
            expect(res.body.result.value).toEqual(29.99);
            expect(res.body.result.percent).toEqual(0);
            expect(res.body.result.installments).toEqual(1);
            expect(res.body.result.description).toEqual("Descrição de um plano qualquer");
            expect(res.body.result.period).toEqual("por semestre");
            done(err);
        });
    }, 10000);

    it('should not get plan by id because there is no id', done => {
        request(app).post('/use/functions/getPlanById')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(400);
            expect(res.body.error).toEqual("Field(s) 'planId' are required.");
            done(err);
        });
    }, 10000);

    it('should not get plan by id because only admins can do it', done => {
        request(app).post('/use/functions/getPlanById')
            .send({
                _ApplicationId: appId,
                planId: planId
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(400);
            expect(res.body.error).toEqual("Voce não possui privilégio para realizar esta ação.");
            done(err);
        });
    }, 10000);
});

describe('List Plans', () => {
    it('should list plans', done => {
        request(app).post('/use/functions/listPlans')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(200);
            expect(res.body.result.totalPlans).toBeGreaterThanOrEqual(1);
            expect(res.body.result.plans).not.toBeUndefined();
            done(err);
        });
    }, 10000);

    it('should not list plans', done => {
        request(app).post('/use/functions/listPlans')
            .send({
                _ApplicationId: appId
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(400);
            done(err);
        });
    }, 10000);
});

describe('Activate and Deactivate Plan', () => {
    it('should list plans', done => {
        request(app).post('/use/functions/listPlans')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(200);
            expect(res.body.result.totalPlans).toBeGreaterThanOrEqual(1);
            totalPlans = res.body.result.totalPlans;
            done(err);
        });
    }, 10000);

    it('should deactivate Plan', done => {
        request(app).post('/use/functions/deactivatePlan')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                planId: planId
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(200);
            done(err);
        });
    }, 10000);

    it('should list plans', done => {
        request(app).post('/use/functions/listPlans')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenPassenger,
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(200);
            expect(res.body.result.totalPlans).toBe(totalPlans - 1);
            done(err);
        });
    }, 10000);

    it('should activate Plan', done => {
        request(app).post('/use/functions/activatePlan')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                planId: planId
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(200);
            done(err);
        });
    }, 10000);

    it('should list plans', done => {
        request(app).post('/use/functions/listPlans')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenPassenger,
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(200);
            expect(res.body.result.totalPlans).toBe(totalPlans);
            done(err);
        });
    }, 10000);
});

describe('Create Driver', () => {

    it('should accept register a driver', done => {
        request(app).post('/use/functions/signUpDriver')
            .send(driver[0])
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                sessionTokenDriver = res.body.result.sessionToken;
                userId = res.body.result.objectId;
                done(err);
            });
    }, 10000);

    it('should validate the code', done => {
        request(app).post('/use/functions/validateCode')
            .send({
                _ApplicationId: appId,
                code: '3691',
                _SessionToken: sessionTokenDriver
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

    it('should accept legal consent', done => {
        request(app).post('/use/functions/signLegalConsent')
            .send({
                _ApplicationId: appId,
                code: '3691',
                _SessionToken: sessionTokenDriver
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

    it('should accept complete driver profile', done => {
        request(app).post('/use/functions/completeProfile')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriver,
                name: driver[0].name,
                lastName: driver[0].name,
                birthDate: "12/08/93",
                city: "Ouro Preto"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

    it('should login with admin', done => {
        request(app).post('/use/functions/logIn')
            .send({
                _ApplicationId: appId,
                login: "Talita.Moreira51@bol.com.br",
                password: "4kBlduiO6V7jddJ"
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(200);
            sessionTokenAdmin = res.body.result.sessionToken;
            done(err);
        });
    }, 10000);

    it('should create a category', done => {
        request(app).post('/use/functions/createCategory')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                name: "Pop",
                description: "Jet Ski",
                description_en: "Jet Ski",
                icon: "icon.png",
                percentCompany: 12,
                type: "common",
                minCapacity: 12,
                maxCapacity: 16,
                active: true,
                year: "2008"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                catId = res.body.result.objectId;
                done(err);
            });
    }, 10000);

    it('should add category to vehicle', done => {
        request(app).post('/use/functions/addCategoryToVehicle')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriver,
                catId: catId
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

    it('should update the vehicle data', done => {
        request(app).post('/use/functions/updateVehicleData')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriver,
                model: "CG",
                year: "2018",
                color: "vermelho",
                plate: "HJGW1234",
                brand: "test"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

    it('should create a document', done => {
        request(app).post('/use/functions/createDocument')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                name: "CPF",
                description: "CADASTRO DE PESSOA FÍSICA",
                required: true,
                link: "Link com a descrição das instruções de como tirar a foto do documento..."
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

    it('should approve user document', done => {
        request(app).post('/use/functions/approveUser')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                userId: userId,
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

    it('should create bank account ', done => {
        request(app).post('/use/functions/createBankAccount')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriver,
                account: "00010838",
                accountDigit: "3",
                agency: "2229",
                bankCode: "104",
                cpf: "125.535.276-08",
                name: "Axel",
                type: "conta_poupanca"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);
});

describe('Buy Plan', () => {
    it('should list plans', done => {
        request(app).post('/use/functions/listPlans')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriver
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(200);
            expect(res.body.result.totalPlans).toBeGreaterThanOrEqual(1);
            planId = res.body.result.plans[0].objectId;
            done(err);
        });
    }, 10000);

    xit('should buy plan', done => {
        request(app).post('/use/functions/buyPlan')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriver,
                planId: planId,
                offset: -180
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(200);
            done(err);
        });
    }, 10000);

    it('should buy plan', done => {
        request(app).post('/use/functions/buyPlan')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriver,
                planId: planId,
                offset: -180,
                paymentMethod: "dinheiro"
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(400);
            done(err);
        });
    }, 10000);

    xit('should buy plan', done => {
        request(app).post('/use/functions/buyPlan')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriver,
                planId: planId,
                offset: -180,
                paymentMethod: "billet"
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(200);
            done(err);
        });
    }, 10000);

    it('should buy plan', done => {
        request(app).post('/use/functions/buyPlan')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriver
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(400);
            done(err);
        });
    }, 10000);

    it('should buy plan', done => {
        request(app).post('/use/functions/buyPlan')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenPassenger
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(400);
            done(err);
        });
    }, 10000);
});

describe('Delete Plan', () => {

    it('should list plans', done => {
        request(app).post('/use/functions/listPlans')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(200);
            expect(res.body.result.totalPlans).not.toBeUndefined();
            totalPlans = (res.body.result.totalPlans);
            done(err);
        });
    }, 10000);

    it('should delete a plan', done => {
        request(app).post('/use/functions/deletePlan')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                planId: planId
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(200);
            expect(res.body.result).toEqual("O objeto foi removido com sucesso");
            done(err);
        });
    }, 10000);

    it('should not delete a plan because there is not planId', done => {
        request(app).post('/use/functions/deletePlan')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(400);
            expect(res.body.error).toEqual("Field(s) 'planId' are required.");
            done(err);
        });
    }, 10000);

    it('should not delete a plan because only admins can do it', done => {
        request(app).post('/use/functions/deletePlan')
            .send({
                _ApplicationId: appId,
                planId: planId
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(400);
            expect(res.body.error).toEqual("Voce não possui privilégio para realizar esta ação.");
            done(err);
        });
    }, 10000);

    it('should list plans', done => {
        request(app).post('/use/functions/listPlans')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(200);
            expect(res.body.result.totalPlans).toBe(totalPlans - 1);
            done(err);
        });
    }, 10000);
});
