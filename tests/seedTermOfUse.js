'use strict'
const Parse = require('parse/node');
const base64 = require('file-base64');
Parse.initialize('N5A1E53IWNIDIDIWOPFNIDBEI55HGWNIDNID');
// Parse.serverURL = 'http://api.yesgo.com.br/use';
Parse.serverURL = 'http://localhost:1982/use';




base64.encode('C:/Users/usemobile/Downloads/Termo_Motorista_Yesgo_2019.pdf', function (err, base64String) {
    let parseFile = new Parse.File('term.pdf', {base64: base64String});
    parseFile.save().then(function (file) {
        console.log("Termo de uso salvo na seguinte url: " + file._url);
    })
});



