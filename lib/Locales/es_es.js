/**
 * Created by André Alenar on 29/11/2019.
 */
const conf = require('config');
let Messages = {
    payment: {
        BONUS: "Bono",
        MONEY: "Dinero"
    },
    success: {
        CREATED_SUCCESS: "El objeto fue creado exitosamente",
        DOWNLOAD_SUCCESS: "Descargar con éxito",
        DELETED_SUCCESS: "El objeto fue eliminado exitosamente",
        EDITED_SUCCESS: "El objeto se actualiza correctamente",
        VALIDATION_SUCCESS: "El telefono fue validado con éxito.",
        SEND_EMAIL_SUCCESS: "Mensaje enviado correctamente",
        RECOVER_EMAIL_SUCCESS: "Siga los pasos enviados a su correo electrónico para restablecer su contador.",
        PASSWORD_CHANGED: "Senha atualizada com sucesso",
        PUSH_SENT: "Notificación enviada con éxito",
        LOCATION_ENABLED: "Estamos operando en la region!",
        ALL_OK: "¿Estás listo para recibir llamadas?",
        MAKE_PASSENGER: "Este conductor se convirtió en pasajero.",
        WITHDRAW_SUCCESS: "¡La cantidad ha sido transferida con éxito a su cuenta!",
        BILLET_SENT: "El ticket ha sido enviado al correo electrónico del usuario.",
        CANCELLATION_FEE: "Cancelar este viaje puede incurrir en una tarifa de $ {{fee}}",
        CANCELLATION_FEE_DRIVER_TO_CLIENT: "La cancelación de este viaje puede ocasionar que se le cobre $ {{fee}}, nuestro equipo evaluará el motivo de la cancelación y puede ser castigado por mala conducta.",
    },
    push: {
        indication_code: conf.IdWall ? "Un amigo usa tu código de referencia " : " Un amigo usa tu código de referencia",
        noDrivers: "No hay controladores disponibles en el área.",
        requestTravel: "Nueva solicitud de viaje",
        travelAccepted: "No hay controladores disponibles en el área.",
        driverWaiting: conf.IdWall ? "El {{driver}} será el lugar de partida. " : " El {{driver}} será el lugar de partida.",
        travelAlreadyAccepted: conf.IdWall ? "Carrera aceptada por otro piloto." : "Carrera aceptada por otro piloto.",
        travelCancelledByDriver: conf.IdWall ? "{{Driver}} cancelar la carrera " : " {{driver}} cancelar la carrera",
        initTravel: "Su viaje ha comenzado",
        initScheduledTravel: "Comenzando su viaje programado",
        driverComing: "Conductor llegando, espere en el lugar indicado.",
        driverArrived: "El conductor lo llevará junto con el cliente.",
        completeTravel: "Viaje completado, califica tu experiencia!",
        registerAccepted: "Su registro ha sido aprobado!",
        registerDeny: "Su registro ha sido denegado!",
        driversBusy: conf.IdWall ? "Nuestros conductores están ocupados en este momento " : " Nuestros conductores están actualmente ocupados",
        rejectValidation: "¡Ops! Su perfil no ha sido aprobado, intente nuevamente.",
        approveValidation: conf.IdWall ? ("¡Uhul! Ahora eres un profesional certificado de " + conf.appName + ".") : ("Uhul! Ahora eres un profesional certificado de " + conf.appName + "."),
        approvePoddValidation: "¡Felicitaciones {{driver}}! Ahora es cooperativo, su número es {{enrollment}}",
        blockUser: "¡Ops! Tu perfil ha sido bloqueado.",
        blockedByCNH: "¡Ops! Su perfil ha sido bloqueado porque su licencia de conducir ha caducado",
        blockedByDoc: "¡Ops! Su perfil ha sido bloqueado porque uno de sus documentos ha expirado. Documento caducado: ",
        unblockUser: "¡Uhul! Tu perfil ha sido desbloqueado.",
        newMessage: "Has recibido un nuevo mensaje de chat",
        cpfValid: "Su registro ha sido aprobado!",
        cpfInvalid: "Su registro ha sido denegado debido al CI.",
        cantReceiveTravel: "Hemos identificado una inactividad en su aplicación. Bravo y volverá a conectarse para recibir llamadas.",
        smsCodeMessage: "Tu código de activación:",
        approveVehicle: "Uhul! Su vehículo acaba de ser aprobado.",
        rejectVehicle: "¡Uy! Su vehículo ha sido rechazado. Contáctanos para más información.",
        sendAlertCNH: "TENGA EN CUENTA: su licencia de conducir caducará en 30 días. Regularizar la situación.",
        sendAlertDoc: "ATENCIÓN: su documento caducará en 30 días. Regularizar la situación.",
        editedPoint: "Hola, tu pasajero ha cambiado la ruta del viaje.",
        offlineBySystem: "Terminas desconectado debido a la inactividad",
        willBeOffline: "No asististe a {{x}} carreras seguidas. ¿Quieres desconectarte?"
    },
    reasons: {
        BLOCK_USER_IN_DEBT: {code: 730, message: "Su usuario ha sido bloqueado por débito"},
        BLOCK_USER_ADMIN: {
            code: 731,
            message: "Su usuario está bloqueado! Para volver a usar la aplicación, contáctenos."
        },
        BLOCK_USER_CNH: {
            code: 732,
            message: "Su usuario está bloqueado! Su CNH ha caducado, regularice su situación para volver a usar la aplicación."
        },
        BLOCK_USER_EXAM: {
            code: 733,
            message: "Su usuario está bloqueado!\n Verifique el estado de su examen médico para volver a usar la aplicación."
        },
        BLOCK_USER_CHECKCAR: {
            code: 734,
            message: "Su usuario está bloqueado! \n Verifique el estado de inspección de su vehículo para reutilizar la aplicación."
        },
    },
    balance: {
        BALANCE_AVAILABLE: "Saldo disponible",
        BALANCE_AWAITING_FUNDS: "Balance bloqueado",
        BALANCE_IN_DEBT: "Saldo deudor",
        BALANCE_AVAILABLE_WITH_NETWORK: "Saldo disponible",
        BALANCE_AWAITING_FUNDS_WITH_NETWORK_AND_VALUE_IS_UNAVAILABLE: "No disponible",
        BALANCE_AWAITING_FUNDS_WITH_NETWORK_AND_NOT_VALUE_IS_UNAVAILABLE: "Ganancias del conductor",
        BALANCE_IN_DEBT_NETWORK: "Ganancias de pasajero",
        NETWORK_VALUE: "Balance de red",
        TRAVEL_VALUE: "Balance de carreras"
    },
    statementValues: {
        travel_money: {
            title: "Viaje en dinero (honorarios)",
            description1: "Dinero ID {{travelId}}",
            description2: "Billetera"
        },
        travel_card: {
            title: "Viaje hecho",
            description1: "Tarjeta ID {{travelId}}",
            description2: "Saldo disponible"
        },
        withdraw: {
            title: "Retirarse",
            description1: "Retirarse de la aplicación",
            description2: "Saldo disponible"
        },
        adminAction: {
            title: "Cambio de saldo por parte del gerente",
            description1: "Realizado por {{admin}}",
            description2: "Billetera"
        },
        billet: {
            title: "Pago de boleto",
            description1: "Recibo de crédito por boleto",
            description2: "Billetera"
        },
        cancellation: {
            title: "Tasa de cancelación",
            description1: "Tarifa de viaje cancelada ID - {{travelId}}",
            description2: "Billetera"
        },
        initialDebt: {
            title: "Valor inicial de la cartera",
            description1: "Valor presente en la Cartera (Saldo adeudado) al comienzo del registro de operaciones",
            description2: "Billetera"
        },
        initialBalance: {
            title: "Valor inicial disponible",
            description1: "Valor presente en el saldo disponible al inicio del registro de operaciones",
            description2: "Billetera"
        }
    },
    invite: {
        FRIEND_INVITE: "<span> ¡Tu amigo <b> {{name}} </b> usó tu invitación! </span>"
    },
    error: {
        ERROR_UNAUTHORIZED: "Usted no se ha autentificado.",
        ERROR_OLD_VERSION_INTEGER: {code: 692, message: "Actualiza tu aplicación para continuar."},
        USERNAME_EXISTS: {code: 601, message: "Este correo electrónico está en uso."},
        INVALID_USERNAME: {code: 601, message: "Incluso si el usuario está equivocado, intente nuevamente."},
        ERROR_EMAIL_NOT_FOUND: {code: 602, message: "Este correo electrónico no está en nuestra base de datos."},
        ERROR_USERNAME_NOT_FOUND: {code: 603, message: "Este nombre de usuario no está en nuestra base de datos."},
        ERROR_CARD_EXITS: {code: 604, message: "Hay una etiqueta con este número."},
        ERROR_ACCESS_REQUIRED: {code: 605, message: "No tienes privilegios para llevar a cabo esta acción."},
        ERROR_INVALID_RATE: {code: 606, message: "El campo de tasa debe estar entre 1 y 5"},
        ERROR_COUPON_NOT_FOUND: {code: 607, message: "El cupón encarnado no es válido."},
        INVALID_PASSWORD: {code: 608, message: "contraseña inválida"},
        ERROR_ALREADY_IN_TRAVEL: {code: 609, message: "Tienes una carrera en progreso."},
        ERROR_PHONE_NOT_FOUND: {code: 610, message: "Código inválido! No se puede registrar el teléfono ..."},
        ERROR_INVALID_DATE: {code: 611, message: "Fecha inválida."},
        ERROR_CARD_NOT_FOUND: {code: 612, message: "Tarjeta no encontrada."},
        ERROR_COUPON_ALREADY_USED: {code: 613, message: "Cupón ya usado."},
        ERROR_INVALID_CATEGORY: {code: 614, message: "Esta solicitud no está disponible."},
        ERROR_GENDER_PERMISSION: {code: 615, message: "Servicio disponible solo de mujer a mujer."},
        ERROR_EXISTS_CPF: "Este CI ya está en uso",
        ERROR_FLOW: {code: 616, message: "Servicio disponible solo para conductores fuera de línea"},
        ERROR_APPROVAL: {code: 617, message: "Sin embargo, hay documentos de este usuario que deberían aprobar."},
        ERROR_NO_DRIVERS: {code: 618, message: "No hay conductores disponibles en el área."},
        ERROR_INVALID_BRAND: {code: 619, message: "Bandera de tarjeta inválida."},
        ERROR_INVALID_PHONE: {code: 620, message: "Número de teléfono no válido"},
        ERROR_INVALID_TRAVEL: {
            code: 621,
            message: conf.IdWall ? "El viaje ya ha sido aceptado por alguien o cancelado por el pasajero.." : "El viaje ya ha sido aceptado por alguien o cancelado por el pasajero.."
        },
        ERROR_INVALID_PLATE: {code: 622, message: "Hey. Número de placa inválido"},
        ERROR_INVALID_CARD: {code: 623, message: "Hey Tarjeta inválida"},
        ERROR_INVALID_BANK_ACCOUNT: {code: 624, message: "Hey No se ha registrado ninguna cuenta bancaria."},
        ERROR_OBJECT_NOT_FOUND: {code: 625, message: "Hey! Objeto no encontrado en el banco."},
        ERROR_UNAVAILABLE_WITHDRAW: {code: 626, message: "Hey! Retirada no disponible."},
        ERROR_PLAN_STILL_AVAILABLE: {code: 627, message: "Hey! ¡El plan actual no ha expirado!"},
        ERROR_DRIVER_ALREADY: {
            code: 628,
            message: conf.IdWall ? "Otro piloto ya ha aceptado esta carrera.." : "Otro piloto ya ha aceptado esta carrera.."
        },
        ERROR_INACTIVE_USER: {code: 629, message: "Usuario deshabilitado"},
        ERROR_REFUSED: {code: 630, message: "transacción denegada"},
        ERROR_CARD_INVALID: {code: 631, message: "No se puede registrar esta tarjeta. "},
        ERROR_YEAR_INVALID: {
            code: 632,
            message: "La acción del automóvil registrada en es compatible con esta categoría."
        },
        ERROR_INSTALLMENTS_INVALID: {code: 633, message: "El número de paquetes debe estar entre 1 y 12"},
        ERROR_INSTALLMENTS_MAX: {code: 634, message: "El número de cuotas no es válido. "},
        ERROR_SAME_USER: {code: 635, message: "Incapaz de aceptar su propia solicitud. "},
        ERROR_FARE_EXISTS: {code: 636, message: "Aquí hay una tarifa activa para esta categoría."},
        ERROR_INDICATION_NOT_EXISTS: {code: 637, message: "El código de referencia no existe."},
        ERROR_CODE_EXISTS: {code: 638, message: "Su código de referencia lo usa para otro usuario"},
        ERROR_WRONG_APP: {code: 605, message: "Está registrado como {{type}}, use la aplicación adecuada."},
        ERROR_CPF_INVALID: {code: 639, message: "El CI ingresado no es válido."},
        ERROR_EMAIL_INVALID: {code: 640, message: "El correo electrónico no está en nuestros registros."},
        ERROR_RADIUS_EXISTS: {code: 641, message: "Ya hay un límite de distancia para esta ubicación."},
        ERROR_RADIUS_WITHOUT_STATE: {code: 642, message: "No se puede crear distancia sin establecer el estado."},
        ERROR_INDICATION_PASSENGER_TO_DRIVER: {
            code: 643,
            message: "No puede registrarse como conductor utilizando el código de un pasajero."
        },
        ERROR_FARE_IN_USE: {code: 644, message: "No se puede eliminar una tarifa que tiene un historial de uso."},
        ERROR_MIN_WITHDRAW: {code: 645, message: "Pequeña cantidad para retirar."},
        ERROR_EDIT_DURATION_OF_PLAN: {code: 646, message: "No puede editar la longitud de un plan."},
        ERROR_EDIT_VALUE_OF_PLAN: {code: 647, message: "No se puede editar el valor de un plan."},
        ERROR_LOCATION_FORBIDDEN: {
            code: 648,
            message: "Sin embargo, no estamos operativos en esta región. Contenedores para mala información."
        },
        ERROR_LOCATION_NOT_FOUN: {
            code: 696,
            message: "Ops, Lamentablemente, no pudimos identificar su ubicación, intente nuevamente o ingrese su ubicación manualmente."
        },
        ERROR_FEE_IN_USER: {
            code: 649,
            message: "No se puede eliminar una tarifa de suscripción que tenga un historial."
        },
        ERROR_USER_BLOCKED: {
            code: 650,
            message: "Tu usuario está bloqueado. Contáctala para más detalles."
        },
        ERROR_COUPON_LIMIT: {code: 651, message: "¡Uy! Este cupón no es válido.."},
        ERROR_ERASE_INVALID: {code: 652, message: "¡Uy! El monto ingresado debe estar entre 0 y la deuda total."},
        ERROR_GPS_INVALID: {
            code: 653,
            message: "No se puede obtener su ubicación actual, verifique si el GPS esté habilitado."
        },
        ERROR_TIME_ALREADY_USED_IN_FARE: {
            code: 654,
            message: "¡Uy! Ya existe una tasa activa para este rango de tiempo."
        },
        ERROR_ERROR_TO_TRACE_ROUTE: {
            code: 655,
            message: "¡Uy! No se puede enrutar entre puntos seleccionados."
        },
        ERROR_CARD_LIMIT: {code: 656, message: "¡Uy! No se pueden agregar más de 5 cartas."},
        ERROR_BLOCK_CARD_CREATION: {
            code: 657,
            message: "¡Uy! Las tarjetas de crédito no pueden registrarse en este momento."
        },
        ERROR_CODE_ALREADY_EXISTS: {code: 658, message: "¡Uy! Este código ya está en uso por otro usuario."},
        ERROR_NOT_IS_DRIVER: {code: 659, message: "El usuario debe ser un conductor."},
        ERROR_NO_BONUS_TO_USE: {
            code: 660,
            message: "¡Uy! No tiene bonificación suficiente para solicitar este viaje, agregue una tarjeta de crédito."
        },
        ERROR_PLATE_EXISTS: {code: 661, message: "¡Uy! Ya hay un vehículo registrado con esta tarjeta."},
        ERROR_OLD_VERSION: {
            code: 662,
            message: "¡Uy! Su solicitud no está actualizada. Descargue la última versión para continuar utilizando los servicios."
        },
        ERROR_MAX_LEN_CODE: {code: 663, message: "La longitud máxima del código de referencia es de 25 caracteres."},
        ERROR_MAX_COUPON_PER_USER: {code: 664, message: "Has alcanzado el límite de uso de tu cupón."},
        ERROR_INVALID_FIELDS_ALLOW: {code: 665, message: "El campo 'allows' está en formato no válido"},
        ERROR_CATEGORY_IN_USE: {code: 666, message: "Algún usuario está usando esta categoría."},
        ERROR_OWNER_VEHICLE: {code: 667, message: "El vehículo pertenece a otro usuario."},
        ERROR_CATEGORY_VEHICLE: {code: 668, message: "No hay categorías vinculadas a este vehículo."},
        ERROR_APPROVE_VEHICLE: {code: 669, message: "Este vehículo ya ha sido aprobado."},
        ERROR_PRIMARY_VEHICLE: {code: 670, message: "Este vehículo se está utilizando como el vehículo principal."},
        ERROR_DOCUMENT_VEHICLE: {code: 671, message: "No hay documentos vinculados a este vehículo."},
        ERROR_VEHICLE_ALREADY_PRIMARY: {
            code: 672,
            message: "Este vehículo ya está registrado como vehículo principal."
        },
        ERROR_VEHICLE_WAITING_APPROVAL: {code: 673, message: "Este vehículo aún no está aprobado."},
        ERROR_NEED_PRIMARY_VEHICLE: {
            code: 674,
            message: "Para excluir este vehículo, debe tener al menos otro vehículo aprobado."
        },
        ERROR_TYPE_EMAIL: {code: 675, message: "Tipo de email inválido"},
        ERROR_BILLEI_PENDING: {code: 676, message: "Ya hay un ticket esperando el pago para este usuario."},
        ERROR_LONG_NAME_BANK_ACCOUNT: {
            code: 677,
            message: "El nombre del propietario de la cuenta bancaria debe tener 30 caracteres o menos."
        },
        ERROR_VEHICLE_ALREADY_CATEGORY: {code: 678, message: "Este vehículo ya está registrado en esta categoría."},
        ERROR_CATEGORY_BILINGUAL_REQUIRED: {
            code: 679,
            message: "El campo de descripción también debe enviarse en otro idioma"
        },
        ERROR_DRIVER_WITHOUT_VEHICLE: {
            code: 680,
            message: "No es posible crear una cuenta bancaria para un conductor sin vehículo."
        },
        ERROR_STATE_NOT_FOUND: {code: 681, message: "Estado no encontrado."},
        ERROR_REQUIRED_ENROLLMENT: {code: 682, message: "El campo de registro es obligatorio."},
        ERROR_EXISTS_ENROLLMENT: {code: 683, message: "Ya hay un pasajero registrado con este registro."},
        ERROR_NO_FEATURE_SUPPORT: {code: 698, message: "Esta característica no está disponible."},
        ERROR_GRADUATION_IN_USE: {
            code: 699,
            message: "La graduación no se puede eliminar ya que está vinculada a uno o más usuarios."
        },
        ERROR_DRIVER_IN_TRAVEL_LOGIN_PASSENGER: {
            code: 701,
            message: "El usuario se encuentra en un viaje como conductor"
        },
        ERROR_DATE_SCHEDULE_TRAVEL: {code: 702, message: "Opss, la fecha de viaje debe ser mayor que la actual."},
        ERROR_AVAILABLE_SCHEDULE_TRAVEL: {
            code: 703,
            message: "El tiempo ingresado pertenece a un rango de otro horario. Verifique e intente nuevamente."
        },
        ERROR_NOT_SCHEDULE_TRAVEL: {code: 704, message: "Esta no es una carrera programada."},
        ERROR_MIN_FOR_WITHDRAW: {code: 705, message: "El monto mínimo de retiro es de $ 5"},
        ERROR_TWO_DRIVERS_SAME_CPF: {code: 706, message: "Has otro conductor unido con este CI"},
        ERROR_METHOD_NOT_IMPLEMENTED: {code: 702, message: "Método no implementado"},
        ERROR_VALUE_NOT_VALID: {code: 191, message: "El valor introducido no es válido."},
        INVALID_PAYMENT: {code: 699, message: "Opción de recepción inválida."},
        BLOCKED_WITHDRAW: {code: 197, message: "No se pudo realizar esta operación."},
        INVALID_TRAVEL_ID: {code: 719, message: "Ops, algo salió mal, comprueba tu conexión a Internet."},
        ERROR_MISS_DOCDATA: {
            code: 720,
            message: "Debe agregar una fecha de vencimiento a todos los documentos donde se verifica la fecha de vencimiento."
        },
        //Pagarme
        ERROR_PAGARME: {code: 700},
        ERROR_SEND_LINKBACK: {code: 707, message: "Enviar el reverso del documento"},
        ERROR_SEND_DOCUMENT: {code: 708, message: "Complete uno de los campos"},
        ERROR_LENGTH_NAME: {code: 709, message: "El nombre debe tener como máximo 30 caracteres"},
        ERROR_UNIQUE_RATE_TRAVEL: {code: 723, message: "Ya calificaste esta carrera"},
        ERROR_CODE_NOT_FOUND: {code: 724, message: "El código de referencia ingresado no es válido."},
        ERROR_INVALID_FIELDS_FORMAT: {code: 725, message: "Algún campo de entrada tiene un formato no válido"},
        ERROR_NO_DRIVERS_CALL_AGAIN: {
            code: 726,
            message: "Carrera redirigida cancelada o rechazada por los conductores."
        },
        ERROR_DOCUMENT_IN_USE: {code: 727, message: "Algún usuario está usando este documento."},
        ERROR_INTERNAL_SERVER_ERROR: { code: 500, message: "Falla del servidor. Póngase en contacto con el administrador de su sistema" },
        FAIL_TO_APPROVE_DRIVER_BY_ENROLLMENT: {code: 729, message: "¡El conductor no pudo ser aprobado! No tiene un número de miembro."},
    },
    receipt: {
        file_html: "receipt_es",
        typePayment: "DINERO",
        currency: "Bs",
        default: {
            travelValue: "VALOR DE LA CARRERA",
            fees: "HONORARIOS",
            cancellationFee: "TARIFA DE CANCELACIÓN",
            valueStoppedDriver: "TARIFA DE ESPERA DEL CONDUCTOR",
            couponValue: "PAGADO CON CUPÓN",
            paidWithBonus: "PAGADO CON BONIFICACIÓN",
            totalValue: "CANTIDAD TOTAL",
            driverCredit: "CRÉDITO GENERADO",
            driverReceive: "USTED RECIBE"
        },
        flipmob: {
            fees: "COSTO FIJO:",
        },
        yesgo: {
            totalValue: "TOTAL RACE CANO:",
            driverCredit: "CRÉDITO GENERADO CON CUPÓN:",
            driverReceive: "USTED RECIBE EN EFECTIVO:",
            driverReceiveBonus: "USTED RECIBE EN CASHBACK: "
        }
    },
    paymentMethod: {
        cash: "Dinero",
        card: "Tarjeta",
        bonus: "Bonificación",
        coupon: "Cupón",
        cashAndBonus: "Dinero + Bonificación"
    },
    profileInfo: "Usuario desde el {{day}} de {{month}} de {{year}}",
    formatErros: function (user, error) {
        error = error || user;
        switch (error.code) {
            case 101:
                return "¡Uy! Objeto no encontrado";
            case 200:
            case 201:
            case 203:
                return "El email o contraseña están en blanco, envíe los campos correctamente.";
            case 1:
            case 2:
            case 4:
                // case 141:
                return "¡Uy! Nuestros servidores estaban confundidos. Inténtalo de nuevo más tarde.";
            case 202:
                return "Este email está en uso.";
            default:
                return error.message;
        }
    }
};

module.exports = Messages;
