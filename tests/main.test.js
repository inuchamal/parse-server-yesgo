let {app, request, config} = require('./config.js');
let utils = require('./utils.js');

//o que será executado antes de todos os testes
beforeAll((done) => {
    app.listen(1982);
    utils.clearDB;
    setTimeout(async () => {
        await require('./seed.js')();
        done()
    }, 10000);
}, 999999);

//o que será executado após todos os testes
afterAll((done) => {
    //o server close irá encerrar nossa aplicação, evitando problemas da porta já estar em uso
    setTimeout(() => {
        utils.clearDB;
        app.close(done);
        console.log("Fechando servidor");
    }, 90000)
}, 99999999);

/* Testando rota principal */
it('Acessando rota principal', done => {
    request(app).get('/').end((err, res) => {
        expect(res ? res.status : 'error').toEqual(200);
        done(err);
    });
});

if (config.appName.toLowerCase() === "demodev") {
    describe('PASSENGER: ', () => {
        require('./methods/Passenger');
    }, 999999999);

    describe('CATEGORY: ', () => {
        require('./methods/Category');
    }, 999999999);

    describe('DRIVER: ', () => {
        require('./methods/Driver');
    }, 999999999);

    describe('ADMINISTRATOR: ', () => {
        require('./methods/Admin');
    }, 999999999);

    describe('CARD: ', () => {
        require('./methods/Card.js');
    }, 999999999);

    describe('TRAVEL: ', () => {
        require('./methods/Travel');
    }, 999999999);

    describe('BLOCKLOGIN: ', () => {
        require('./methods/Config/BlockLogin');
    }, 999999999);

    describe('CANCELLATION: ', () => {
        require('./methods/Config/Cancellation');
    }, 999999999);

    describe('CODE: ', () => {
        require('./methods/Config/Code');
    }, 999999999);

    describe('CANCELLATION REASON', () => {
        require('./methods/CancellationReason');
    }, 999999999);

    describe('Contact Us: ', () => {
        require('./methods/ContactUs');
    }, 999999999);

    describe('NEW SIGN UP: ', () => {
        require('./methods/newSignUp');
    }, 999999999);
}

if ((config.appName.toLowerCase() === "mobdrive") && config.hasCancellation && config.cancelationClient && config.cancellationDriver) {
    describe('MOBDRIVE: ', () => {
        require('./methods/Config/MobDrive');
    }, 999999999);
}

if ((config.appName.toLowerCase() === "mova") && config.usePlan && config.usePlanRetention) {
    describe('MOVA: ', () => {
        require('./methods/Config/Mova');
    }, 999999999);
}

if (config.usePlan && config.usePlanRetention) {
    describe('PLAN: ', () => {
        require('./methods/Config/Plan');
    }, 999999999);
}

if (config.appName.toLowerCase() === "one" && config.payment.blockCardPayment && config.payment.hidePayment) {
    describe('One Corporativo: ', () => {
        require('./methods/Config/One');
    }, 999999999);
}

if (config.bonusLevel) {
    describe('BONUSLEVEL: ', () => {
        require('./methods/Config/BonusLevel');
    }, 999999999);
}

if (config.appName.toLowerCase() === "flipmob") {
    describe('FLIPMOB', () => {
        require('./methods/Config/Flip.js')
    }, 999999999);
}

if(config.payment.module.toLowerCase() === "iugu"){
    describe("IUGU",()=>{
        require('./methods/Config/Iugu.js');
    });
}

if(config.recallAfterCancellation){
    describe("IUGU",()=>{
        require('./methods/Config/RecallAfterCancellation.js');
    });
}
