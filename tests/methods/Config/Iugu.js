const {request, app, config} = require('../../config');
const appId = config.appId;

let sessionTokenAdmin;

describe("Account configuration ", () => {
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
    it('should retrieve account information', done => {
        request(app).post('/use/functions/getSettingAccount')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(200);
            let result = res.body.result;
            if (result.errors)
                expect(result.errors).toEqual("Apenas disponível para o ambiente produção");
            else
                expect(result.configuration.credit_card.two_step_transaction).toEqual(true);
            done(err);
        });
    }, 10000);

});


