/**
 * Created by Patrick on 03/05/2017.
 */
const conf = require('config');
let Messages = {
        payment: {
            BONUS: "Bônus",
            MONEY: "Dinheiro"
        },
        success: {
            CREATED_SUCCESS: "O objeto foi criado com sucesso",
            DOWNLOAD_SUCCESS: "Download realizado com sucesso",
            DELETED_SUCCESS: "O objeto foi removido com sucesso",
            EDITED_SUCCESS: "O objeto foi atualizado com sucesso",
            VALIDATION_SUCCESS: "O celular foi validado com sucesso",
            SEND_EMAIL_SUCCESS: "Mensagem enviada com sucesso",
            RECOVER_EMAIL_SUCCESS: "Siga os passos enviados ao seu e-mail para redefinir sua senha",
            PASSWORD_CHANGED: "Senha atualizada com sucesso",
            PUSH_SENT: "Notificação enviada com sucesso",
            LOCATION_ENABLED: "Estamos em funcionamento na região!",
            ALL_OK: "Você esta pronto para receber chamadas!",
            MAKE_PASSENGER: "Este motorista se tornou um passageiro",
            WITHDRAW_SUCCESS: "O valor foi transferido para sua conta com sucesso!",
            BILLET_SENT: "O boleto foi enviado para o e-mail do usuário",
            CANCELLATION_FEE: "O cancelamento desta viagem pode causar cobrança de taxa no valor de R$ {{fee}}",
            CANCELLATION_FEE_DRIVER_TO_CLIENT: "O cancelamento desta viagem pode causar cobrança ao passageiro no valor de R$ {{fee}}, nossa equipe avaliará o motivo do cancelamento e em caso de má conduta você poderá ser punido.",
        },
        push: {
            indication_code: conf.IdWall ? "Uma amiga usou seu código de indicação" : "Um amigo usou seu código de indicação",
            noDrivers: "Não há motoristas disponíveis na região.",
            requestTravel: "Nova solicitação de viagem",
            travelAccepted: "{{driver}} vai chegar em breve em um {{vehicle}}.",
            driverWaiting: conf.IdWall ? "A {{driver}} chegou ao local de partida." : "O {{driver}} chegou ao local de partida.",
            travelAlreadyAccepted: conf.IdWall ? "Corrida aceita por outra motorista." : "Corrida aceita por outro motorista.",
            travelCancelledByDriver: conf.IdWall ? "A {{driver}} cancelou a corrida" : "O {{driver}} cancelou a corrida",
            initTravel: "A sua viagem foi iniciada",
            initScheduledTravel: "Iniciando sua viagem agendada",
            driverComing: "Motorista chegando, aguarde no local indicado.",
            driverArrived: "Motorista chegou ao ponto de encontro com o cliente.",
            completeTravel: "Viagem concluída, avalie sua experiência!",
            registerAccepted: "O seu cadastro foi aprovado!",
            registerDeny: "O seu cadastro foi negado!",
            driversBusy: conf.IdWall ? "Nossas motoristas estão ocupados no momento" : "Nossos motoristas estão ocupados no momento",
            rejectValidation: "Ops! Seu perfil não foi aprovado, tente novamente.",
            approveValidation: conf.IdWall ? ("Uhul! Você agora é uma profissional certificada da " + conf.appName + ".") : ("Uhul! Você agora é um profissional certificado do " + conf.appName + "."),
            approvePoddValidation: "Parabéns {{driver}}! Você agora é um cooperado, seu número é {{enrollment}}.",
            blockUser: "Ops! Seu perfil foi bloqueado.",
            blockedByCNH: "Ops! Seu perfil foi bloqueado pois usa carteira de motorista está vencida",
            blockedByDoc: "Ops! Seu perfil foi bloqueado pois um de seus documentos está vencido. Documento vencido: ",
            unblockUser: "Uhul! Seu perfil foi desbloqueado.",
            newMessage: "Você recebeu uma nova mensagem no chat",
            cpfValid: "Seu cadastro foi aprovado!",
            cpfInvalid: "Seu cadastro foi negado devido ao CPF.",
            cantReceiveTravel: "Identificamos uma inatividade no seu aplicativo. Abra-o e fique online novamente para receber chamadas.",
            smsCodeMessage: "Seu código de ativação é: ",
            approveVehicle: "Uhul! Seu veículo acaba de ser aprovado.",
            rejectVehicle: "Ops! Seu veículo foi reprovado. Entre em contato conosco para mais informaçãoes.",
            sendAlertCNH: "ATENÇÃO: Sua carteira de motorista irá vencer em 30 dias. Regularize a situação.",
            sendAlertDoc: "ATENÇÃO: Seu documento irá vencer em 30 dias. Regularize a situação.",
            editedPoint: "Olá seu passageiro alterou a rota da viagem!",
            offlineBySystem: "Você acabar de ficar offline por inatividade",
            willBeOffline: "Você não atendeu a {{x}} corridas seguidas. Deseja ficar offline ?"
        },
        reasons: {
            BLOCK_USER_IN_DEBT: {code: 730, message: "Seu usuário foi bloqueado por possuir débito superior ao limite"},
            BLOCK_USER_ADMIN: {
                code: 731,
                message: "Seu usuário está bloqueado! Para voltar a utilizar o aplicativo, entre em contato."
            },
            BLOCK_USER_CNH: {
                code: 732,
                message: "Seu usuário está bloqueado! Sua CNH está vencida, regularize sua situação para voltar a utilizar o aplicativo."
            },
            BLOCK_USER_EXAM: {
                code: 733,
                message: "Seu usuário está bloqueado! \n Verifique o status do seu exame médico para voltar a utilizar o aplicativo."
            },
            BLOCK_USER_CHECKCAR: {
                code: 734,
                message: "Seu usuário está bloqueado! \n Verifique o estado da vistoria do seu veículo para voltar a utilizar o aplicativo."
            },
        },
        statementValues: {
            travel_money: {
                title: "Corrida no dinheiro (Taxas)",
                description1: "Dinheiro ID {{travelId}}",
                description2: "Carteira"
            },
            travel_card: {
                title: "Corrida efetuada",
                description1: "Cartão ID {{travelId}}",
                description2: "Saldo Disponível"
            },
            withdraw: {
                title: "Saque",
                description1: "Saque pelo aplicativo",
                description2: "Saldo disponível"
            },
            adminAction: {
                title: "Alteração de saldo pelo gestor",
                description1: "Realizado por {{admin}}",
                description2: "Carteira"
            },
            billet: {
                title: "Pagamento de boleto",
                description1: "Recebimento de crédito por boleto",
                description2: "Carteira"
            },
            cancellation: {
                title: "Taxa de cancelamento",
                description1: "Taxa por viagem cancelada ID - {{travelId}}",
                description2: "Carteira"
            },
            wallet_transfer: {
                title: "Crédito por desconto em corrida",
                description1: "Crédito por desconto automatico",
                description2: "Carteira"
            },
            initialDebt: {
                title: "Valor inicial da Carteira",
                description1: "Valor presente na Carteira (Saldo devedor) no inicio do registro das operações",
                description2: "Carteira"
            },
            initialBalance: {
                title: "Valor disponível inicial",
                description1: "Valor presente no saldo disponível no inicio do regostro das operações",
                description2: "Carteira"
            }
        },
        balance: {
            BALANCE_AVAILABLE: "Saldo Disponível",
            BALANCE_AWAITING_FUNDS: "Saldo Bloqueado",
            BALANCE_IN_DEBT: "Saldo Devedor",
            BALANCE_AVAILABLE_WITH_NETWORK: "Saldo Disponível",
            BALANCE_AWAITING_FUNDS_WITH_NETWORK_AND_VALUE_IS_UNAVAILABLE: "Não Disponível",
            BALANCE_NOT_RELEASED: "Valor em trânsito",
            BALANCE_AWAITING_FUNDS_WITH_NETWORK_AND_NOT_VALUE_IS_UNAVAILABLE: "Ganhos de Motorista",
            BALANCE_IN_DEBT_NETWORK: "Ganhos de passageiros",
            NETWORK_VALUE: "Saldo de rede",
            TRAVEL_VALUE: "Saldo de corridas"
        },
        invite: {
            FRIEND_INVITE: "<span>Seu amigo <b> {{name}} </b> utilizou o seu convite! </span>"
        },
        error: {
            ERROR_UNAUTHORIZED: "Voce não esta logado.",
            ERROR_OLD_VERSION_INTEGER: {code: 692, message: "Atualize sua aplicação para continuar."},
            USERNAME_EXISTS: {code: 601, message: "Este e-mail já esta sendo utilizado."},
            INVALID_USERNAME: {code: 601, message: "Nome de usuário ou senha incorretos, tente novamente."},
            ERROR_EMAIL_NOT_FOUND: {code: 602, message: "Este e-mail não consta em nosso banco de dados"},
            ERROR_USERNAME_NOT_FOUND: {code: 603, message: "Este username não consta em nosso banco de dados"},
            ERROR_CARD_EXITS: {code: 604, message: "Já existe um cartão com este numero"},
            ERROR_ACCESS_REQUIRED: {code: 605, message: "Voce não possui privilégio para realizar esta ação."},
            ERROR_INVALID_RATE: {code: 606, message: "O Campo 'rate' deve ser entre 1 e 5"},
            ERROR_COUPON_NOT_FOUND: {code: 607, message: "O cupom digitado não é válido."},
            INVALID_PASSWORD: {code: 608, message: "Senha inválida"},
            ERROR_ALREADY_IN_TRAVEL: {code: 609, message: "Voce possui uma corrida em andamento."},
            ERROR_PHONE_NOT_FOUND: {code: 610, message: "Código inválido! O celular não pôde ser cadastrado."},
            ERROR_INVALID_DATE: {code: 611, message: "Data inválida."},
            ERROR_CARD_NOT_FOUND: {code: 612, message: "Cartão não encontrado."},
            ERROR_COUPON_ALREADY_USED: {code: 613, message: "Cupom já utilizado."},
            ERROR_INVALID_CATEGORY: {code: 614, message: "Esta solicitação ainda não está disponível."},
            ERROR_GENDER_PERMISSION: {code: 615, message: "Serviço disponível apenas de mulheres para mulheres."},
            ERROR_EXISTS_CPF: {code: 730, message: "Este CPF já esta sendo utilizado"},
            ERROR_FLOW: {code: 616, message: "Serviço disponível apenas para motoristas offline."},
            ERROR_APPROVAL: {code: 617, message: "Ainda existem documentos deste usuário que precisam ser aprovados."},
            ERROR_NO_DRIVERS: {code: 618, message: "Não há motoristas disponíveis na região."},
            ERROR_INVALID_BRAND: {code: 619, message: "Bandeira de cartão inválida."},
            ERROR_INVALID_PHONE: {code: 620, message: "Número de telefone inválido."},
            ERROR_INVALID_TRAVEL: {
                code: 621,
                message: conf.IdWall ? "A viagem já foi aceita por alguém ou cancelada pela passageira." : "A viagem já foi aceita por alguém ou cancelada pelo passageiro."
            },
            ERROR_INVALID_PLATE: {code: 622, message: "Ops! Número da placa inválida."},
            ERROR_INVALID_CARD: {code: 623, message: "Ops! Cartão inválido."},
            ERROR_INVALID_BANK_ACCOUNT: {code: 624, message: "Ops! Você não cadastrou nenhuma conta bancária ainda."},
            TEMPORARY_UNAVAILABLE: {code: 625, message: "Ops! esta função está temporariamente indisponível."},
            ERROR_OBJECT_NOT_FOUND: {code: 625, message: "Ops! Objeto não encontrado no banco."},
            ERROR_UNAVAILABLE_WITHDRAW: {code: 626, message: "Ops! Saque indisponível."},
            ERROR_PLAN_STILL_AVAILABLE: {code: 627, message: "Seu plano atual ainda não expirou!"},
            ERROR_DRIVER_ALREADY: {
                code: 628,
                message: conf.IdWall ? "Outra motorista já aceitou esta corrida." : "Outro motorista já aceitou esta corrida."
            },
            ERROR_INACTIVE_USER: {code: 629, message: "Usuário desativado"},
            ERROR_REFUSED: {code: 630, message: "Transação negada"},
            ERROR_CARD_INVALID: {code: 631, message: "Não foi possivel cadastrar este cartão. "},
            ERROR_YEAR_INVALID: {code: 632, message: "O ano do carro cadastrado não é compatível com esta categoria."},
            ERROR_INSTALLMENTS_INVALID: {code: 633, message: "O numero de parcelas deve estar entre 1 e 12"},
            ERROR_INSTALLMENTS_MAX: {code: 634, message: "O numero de parcelas é invalido. "},
            ERROR_SAME_USER: {code: 635, message: "Não é possível aceitar a própria requisição. "},
            ERROR_FARE_EXISTS: {code: 636, message: "Já existe uma tarifa ativa para esta categoria."},
            ERROR_INDICATION_NOT_EXISTS: {code: 637, message: "O código de indicação não existe"},
            ERROR_CODE_EXISTS: {code: 638, message: "O código de indicação já é utilizado por outro usuário"},
            ERROR_WRONG_APP: {code: 605, message: "Você está cadastrado como {{type}}, utilize o aplicativo apropriado."},
            ERROR_CPF_INVALID: {code: 639, message: "O CPF digitado é inválido."},
            ERROR_EMAIL_INVALID: {code: 640, message: "O e-mail não consta em nossos registros."},
            ERROR_RADIUS_EXISTS: {code: 641, message: "Já existe um limite de distancia para esta localidade."},
            ERROR_RADIUS_WITHOUT_STATE: {code: 642, message: "Não é possivel criar uma distancia sem definir o estado."},
            ERROR_INDICATION_PASSENGER_TO_DRIVER: {
                code: 643,
                message: "Não é possivel se cadastrar como motorista utilizando o código de um passageiro."
            },
            ERROR_FARE_IN_USE: {code: 644, message: "Não é possivel deletar uma tarifa que possui histórico de uso."},
            ERROR_MIN_WITHDRAW: {code: 645, message: "Valor pequeno para realizar saque."},
            ERROR_EDIT_DURATION_OF_PLAN: {code: 646, message: "Não é possivel editar a duração de um plano."},
            ERROR_EDIT_VALUE_OF_PLAN: {code: 647, message: "Não é possivel editar o valor de um plano."},
            ERROR_LOCATION_FORBIDDEN: {
                code: 648,
                message: "Ainda não estamos em funcionamento nesta região. Entre em contato para maiores informações."
            },
            ERROR_LOCATION_NOT_FOUN: {
                code: 696,
                message: "Ops, infelizmente não conseguimos identificar sua localização, por favor tente novamente ou insira sua localização manualmente."
            },
            ERROR_FEE_IN_USER: {code: 649, message: "Não é possivel deletar uma taxa de inscrição que possui histórico."},
            ERROR_USER_BLOCKED: {
                code: 650,
                message: "Seu usuário esta bloqueado. Entre em contato com a administração para mais detalhes."
            },
            ERROR_COUPON_LIMIT: {code: 651, message: "Ops! Esse cupom não é válido mais."},
            ERROR_ERASE_INVALID: {code: 652, message: "Ops! O valor digitado deve ser entra 0 e o total da dívida."},
            ERROR_GPS_INVALID: {
                code: 653,
                message: "Não foi possível obter sua localização atual, favor verificar se o GPS esta ativado."
            },
            ERROR_TIME_ALREADY_USED_IN_FARE: {
                code: 654,
                message: "Ops! Já existe uma tarifa ativa para esse intervalo de tempo."
            },
            ERROR_ERROR_TO_TRACE_ROUTE: {
                code: 655,
                message: "Ops! Não foi possivel traçar uma rota entre os pontos selecionados."
            },
            ERROR_CARD_LIMIT: {code: 656, message: "Ops! Não é possível adicionar mais de 5 cartões."},
            ERROR_BLOCK_CARD_CREATION: {code: 657, message: "Ops! No momento não é possivel cadastrar cartões de crédito."},
            ERROR_CODE_ALREADY_EXISTS: {code: 658, message: "Ops! Esse código já esta sendo utilizado por outro usuário."},
            ERROR_NOT_IS_DRIVER: {code: 659, message: "O usuário deve ser um motorista."},
            ERROR_NO_BONUS_TO_USE: {
                code: 660,
                message: "Ops! Você não possui bônus suficiente para solicitar está viagem, adicione um cartão de crédito."
            },
            ERROR_PLATE_EXISTS: {code: 691, message: "Ops! Já existe um véiculo cadastrado com esta placa."},
            ERROR_OLD_VERSION: {
                code: 662,
                message: "Ops! Seu aplicativo esta desatualizado. Favor baixar a ultima versão para continuar utilizando os serviços."
            },
            ERROR_MAX_LEN_CODE: {code: 663, message: "O tamanho maximo do código de indicação é de 25 caracteres"},
            ERROR_MAX_COUPON_PER_USER: {code: 664, message: "Você atingiu o limite de uso deste cupom."},
            ERROR_INVALID_FIELDS_ALLOW: {code: 665, message: "O campo allows está com formato inválido."},
            ERROR_CATEGORY_IN_USE: {code: 666, message: "Algum usuário está utilizando esta categoria."},
            ERROR_OWNER_VEHICLE: {code: 667, message: "Veículo pertence a outro usuário."},
            ERROR_CATEGORY_VEHICLE: {code: 668, message: "Nenhuma categoria vinculada a este veículo."},
            ERROR_APPROVE_VEHICLE: {code: 669, message: "Este veículo já foi aprovado."},
            ERROR_PRIMARY_VEHICLE: {code: 670, message: "Este veículo está sendo utilizado como veículo principal."},
            ERROR_DOCUMENT_VEHICLE: {code: 671, message: "Nenhum documento vinculado a este veículo."},
            ERROR_VEHICLE_ALREADY_PRIMARY: {code: 672, message: "Este veículo já está cadastrado como véiculo principal."},
            ERROR_VEHICLE_WAITING_APPROVAL: {code: 673, message: "Este veículo está ainda não está aprovado."},
            ERROR_NEED_PRIMARY_VEHICLE: {
                code: 674,
                message: "Para excluir este veículo é necessário ter pelo menos outro véiculo aprovado."
            },
            ERROR_TYPE_EMAIL: {code: 675, message: "Tipo de email inválido"},
            ERROR_BILLEI_PENDING: {code: 676, message: "Já existe um boleto aguardando pagamento para este usuário."},
            ERROR_LONG_NAME_BANK_ACCOUNT: {
                code: 677,
                message: "O nome do proprietário da conta bancária dever ter no máximo 30 caracteres."
            },
            ERROR_VEHICLE_ALREADY_CATEGORY: {code: 678, message: "Este veículo já esta cadastrado nesta categoria."},
            ERROR_CATEGORY_BILINGUAL_REQUIRED: {
                code: 679,
                message: "O campo descrição deve ser enviado também em outro idioma"
            },
            ERROR_DRIVER_WITHOUT_VEHICLE: {
                code: 680,
                message: "Não é possível criar conta bancária para um motorista sem veiculo."
            },
            ERROR_STATE_NOT_FOUND: {code: 681, message: "Estado não encontrado."},
            ERROR_REQUIRED_ENROLLMENT: {code: 682, message: "O campo matrícula é obrigatório."},
            ERROR_EXISTS_ENROLLMENT: {code: 683, message: "Já existe um passageiro cadastrado com essa matrícula."},
            ERROR_NO_FEATURE_SUPPORT: {code: 698, message: "Este recurso não está disponível."},
            ERROR_GRADUATION_IN_USE: {
                code: 699,
                message: "A graduação não pode ser removida pois está vinculada a um ou mais usuários."
            },
            ERROR_DRIVER_IN_TRAVEL_LOGIN_PASSENGER: {
                code: 701,
                message: "Usuário se encontra em uma viagem como motorista"
            },
            ERROR_DATE_SCHEDULE_TRAVEL: {code: 702, message: "Opss, a data da viagem deve ser superior a atual."},
            ERROR_AVAILABLE_SCHEDULE_TRAVEL: {
                code: 703,
                message: "O horário informado pertence à um intervalo de outro agendamento. Verifique e tente novamente."
            },
            ERROR_NOT_SCHEDULE_TRAVEL: {code: 704, message: "Esta não é uma corrida agendada"},
            ERROR_MIN_FOR_WITHDRAW: {code: 705, message: "O valor mínimo de saque é de R$5,00"},
            ERROR_TWO_DRIVERS_SAME_CPF: {code: 706, message: "Você possui outro cadastro de motorista com esse cpf"},
            ERROR_METHOD_NOT_IMPLEMENTED: {code: 702, message: "Método não implementado"},
            ERROR_VALUE_NOT_VALID: {code: 191, message: "O valor informado não é valido"},
            INVALID_PAYMENT: {code: 699, message: "Opção de recebimento inválida."},
            BLOCKED_WITHDRAW: {code: 197, message: "Nao foi possivel realizar essa operação."},
            INVALID_TRAVEL_ID: {code: 719, message: "Ops, algo deu errado, verifique sua conexão com a internet."},
            INVALID_POINT: {code: 720, message: "Ops, parada invalida."},
            USER_DOES_NOT_BELONG_TRAVEL: {
                code: 721,
                message: "Este usuário não é um motorista e nem um passageiro desta corrida."
            },

            ERROR_MISS_DOCDATA: {
                code: 720,
                message: "É necessário adicionar uma data de vencimento em todos os documentos onde a data de vencimento é verificada"
            },
            ERROR_INTERNAL_SERVER_ERROR: { code: 500, message: "Erro interno de servidor. Contate o administrador do sistema" },
            //Pagarme
            ERROR_PAGARME: {code: 700},
            ERROR_SEND_LINKBACK: {code: 707, message: "Envie o verso do documento"},
            ERROR_SEND_DOCUMENT: {code: 708, message: "Preencha um dos campos"},
            ERROR_LENGTH_NAME: {code: 709, message: "O nome deve ter no máximo 30 caracteres."},
            ERROR_INSUFICIENT_BALANCE: {code: 961, message: "Ops, saldo insuficiente!"},
            ERROR_LOCATION_OR_PLACEID: {code: 709, message: "Submission of location or placeId is required."},
            ERROR_UNIQUE_RATE_TRAVEL: {code: 723, message: "Você já avaliou está corrida."},
            ERROR_CODE_NOT_FOUND: {code: 607, message: "O código de indicação digitado não é válido."},
            ERROR_INVALID_POINTS: {code: 724, message: "Invalid points."},
            INVALID_DATE_IN_STOP: {code: 725, message: "Data da parada inválida."},
            ERROR_INVALID_FIELDS_FORMAT: {code: 726, message: "Algum campo de entrada está com formato inválido."},
            ERROR_NO_DRIVERS_CALL_AGAIN: {
                code: 727,
                message: "Corrida redirecionada cancelada ou recusada pelos motoristas."
            },
            ERROR_DOCUMENT_IN_USE: {code: 728, message: "Algum usuário está utilizando este documento."},
            FAIL_TO_APPROVE_DRIVER_BY_ENROLLMENT: {code: 729, message: "Motorista não pôde ser aprovado! Não possui número do cooperado."},
        },
        receipt: {
            file_html: "receipt",
            typePayment: "DINHEIRO",
            currency: "R$",
            default: {
                travelValue: "VALOR DA CORRIDA: ",
                fees: "TAXAS: ",
                cancellationFee: "TAXA DE CANCELAMENTO: ",
                valueStoppedDriver: "TAXA DE ESPERA DO MOTORISTA: ",
                couponValue: "PAGO COM CUPOM: ",
                paidWithBonus: "PAGO COM BONUS: ",
                totalValue: "VALOR TOTAL: ",
                driverCredit: "CRÉDITO GERADO: ",
                driverReceive: "VOCÊ RECEBE: "
            },
            flipmob: {
                fees: "CUSTO FIXO: ",
            },
            yesgo: {
                totalValue: "VALOR TOTAL DA CORRIDA: ",
                totalCashWithBonus: "VALOR À PAGAR EM DINHEIRO: ",
                driverCredit: "CRÉDITO GERADO COM CUPOM: ",
                driverReceive: "VOCÊ RECEBE EM DINHEIRO: ",
                driverReceiveBonus: "VOCÊ RECEBE EM CASHBACK: "
            }
        },
        paymentMethod: {
            cash: "Dinheiro",
            card: "Cartão",
            bonus: "Bônus",
            coupon: "Cupom",
            cashAndBonus: "Dinheiro + Bônus"
        },
        profileInfo: "Usuário desde {{day}} de {{month}} de {{year}}",
        formatErros:

            function (user, error) {
                error = error || user;
                switch (error.code) {
                    case 101:
                        return "Ops! Objeto não encontrado";
                    case 200:
                    case 201:
                    case 203:
                        return "Email ou senha estão em branco, favor enviar os campos corretamente.";
                    case 1:
                    case 2:
                    case 4:
                        // case 141:
                        return "Ops! Nossos servidores se confundiram. Tente novamtne mais tarde.";
                    case 202:
                        return "Este e-mail já esta sendo utilizado.";
                    default:
                        return error.message;
                }
            }
    }
;

module.exports = Messages;
