// Lambda Function code for Alexa.
// Paste this into your index.js file. 
// Testing functionality

const Alexa = require("ask-sdk-core");
const https = require("https");
const fetch = require('node-fetch');

const invocationName = "auto garcon";
var alexaID = '';
var restaurantID = '';
var tableNum = '';
var restaurantName = '';
var customerID = '';

async function fetch_data(restaurantID) {
    let endpoint = 'https://autogarcon.live/api/restaurant/'+restaurantID+'/menu/available';
    let result = fetch(endpoint);
    result = await result;
    result = result.json();
    result = await result;
    return result;
};

async function fetch_restaurant(alexaID) {
    let res = fetch("https://autogarcon.live/api//tables?alexaid=" + alexaID);
    res = await res;
    res = res.json();
    res = await res;
    
    return res;
};

async function fetch_restaurant_name(resturantID) {
    let res = fetch("https://autogarcon.live/api/restaurant/" + restaurantID);
    res = await res;
    res = res.json();
    res = await res;
    return res;
};

function httpsPost(path,body){
    var options = {
    hostname: 'autogarcon.live',
    path: path,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        }
    };

    var req = https.request(options, (res) => {
    //console.log('statusCode:', res.statusCode);
    });
    req.write(JSON.stringify(body));
    req.end();

};

function httpsGet(path){
    var options = {
    hostname: 'autogarcon.live',
    path: path,
    method: 'GET'
    };
    const req = https.request(options, res => {
        console.log(`statusCode: ${res.statusCode}`)
      
        res.on('data', d => {
          process.stdout.write(d)
        });
      });
    req.end();
};
/*
async function httpsEmptyPost(path){
    var options = {
    hostname: 'autogarcon.live',
    path: path,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        }
    };
    var req = https.request(options, (res) => {
        console.log('statusCode:', res.statusCode);
    });
    req.write(`{}`);
    req.end();
}

var submitOrderPath = '/api/restaurant/'+restaurantID+'/tables/'+tableNumber+'/order/submit';

httpsEmptyPost(submitOrderPath);

*/

// Session Attributes 
//   Alexa will track attributes for you, by default only during the lifespan of your session.
//   The history[] array will track previous request(s), used for contextual Help/Yes/No handling.
//   Set up DynamoDB persistence to have the skill save and reload these attributes between skill sessions.

/////////////////////////////////////////////////////////////////////////////////////////////
//THIS IS GETTING A LIST OF CATEGORIES
function jsonParser(stringValue) {

   var string = JSON.stringify(stringValue);
   var objectValue = JSON.parse(string);
   return objectValue;
}

var dinnerMenu = [];//jsonParser(jsonDinnerMenu);

//for our build order functionality
var currentOrder = [];
var currentItem;
var catIndex = 0;

//ListOfCategories:fills the categories array with the appropriate category 
//Author:Max
function ListOfCategories() {
    let categories = [];
    
    for (var i = 0; i < dinnerMenu.length; i++){
        let category = dinnerMenu[i].category.toString();
        category = category.replace('&', ' and ');
        if(categories.includes(category) == false){
            categories.push(category);
        }
    }
    
    return categories.toString().trim();
}

//FindItem:this will return an object based on a text string match with the name of the item
//Author:Max
function FindItem(itemName){
    for (var i = 0; i < dinnerMenu.length; i++) {
        if(dinnerMenu[i].name.toLowerCase() == itemName.toLowerCase()){
            return dinnerMenu[i];
        }
    }
}

//FindItemInOrder:this will return the index of the itemObject in the current order
//Author:Max
function FindItemInOrder(itemObject){
    for (let i = 0; i < currentOrder.length; i++) {
    if (currentOrder[i] === itemObject) {
       return i;
    }
}
}

//GetPrice: returns the price of an item
//Author: Max
function GetPrice(itemObject){
    return itemObject.price;
    
}

//GetPrice: returns the price of an item
//Author: Ben
function GetDescription(itemObject){
    return itemObject.description;
}

//AddToOrder: adds item to current order
//Author:Max
async function AddToOrder(itemObject){
    var item = { 
    "menuItemID": itemObject.itemID, 
    "menuID":itemObject.menuID,
    "quantity":1,
    "comments": itemObject.mod,
    "price": itemObject.price
    };

    var addToOrderPath = '/api/restaurant/'+restaurantID+'/tables/'+tableNum+'/order/add';

    //This will keep it in our current order list so we don't have to repull when reading off the menu
    currentOrder.push(itemObject);
    //This sends it to the database
    await httpsPost(addToOrderPath,item);
}

//RemoveFromOrder: removes an item from the current order
//Author: Jack,Max
async function RemoveFromOrder(itemObject){
    let newOrder = []
    for (let i = 0; i < currentOrder.length; i++) {
        if (currentOrder[i] !== itemObject) {
            newOrder.push(currentOrder[i])
        }
    }
    let result = currentOrder !== newOrder;
    currentOrder = newOrder;
    var removeEndpoint = "/api/restaurant/"+restaurantID+"/tables/"+tableNum+"/order/remove";
    await httpsPost(removeEndpoint,{"menuItemID":itemObject.itemID});

    return result;
}

//ReadCurrentOrder: reads back the current order
//Author: Jack,Max
function ReadCurrentOrder(){
    let say = "";
    if(currentOrder.length == 0){
        say = "There are currently no items in your order";
    }
    else{
        for(var i =0; i < currentOrder.length; i++){
            if(currentOrder[i].mod !== undefined){
                say += currentOrder[i].name + " with "+currentOrder[i].mod+", "
            }
            else{
                say += currentOrder[i].name + ", ";
            }
        }
    }
    return say; //+ fetched_time;
}

/////////////////////////////////////////////////////////////////////////////////
//END GET LIST OF CATEGORIES

//Amazon default function
function getMemoryAttributes() {   const memoryAttributes = {
       "history":[],

        // The remaining attributes will be useful after DynamoDB persistence is configured
       "launchCount":0,
       "lastUseTimestamp":0,

       "lastSpeechOutput":{},
       "nextIntent":[]

       // "favoriteColor":"",
       // "name":"",
       // "namePronounce":"",
       // "email":"",
       // "mobileNumber":"",
       // "city":"",
       // "state":"",
       // "postcode":"",
       // "birthday":"",
       // "bookmark":0,
       // "wishlist":[],
   };
   return memoryAttributes;
};

const maxHistorySize = 30; // remember only latest 20 intents 

// 1. Intent Handlers =============================================
const AllergenFilter_Handler = {
  canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'AllergenFilter' ;
    },
    handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        let say = "";
        let allergen = "";
        let isIsnot = "";
        let slotValues = getSlotValues(request.intent.slots);
        
        if(handlerInput.requestEnvelope.request.intent.slots.IsIsnot === undefined) {
            say = "couldn't resolve IsIsnot";
        } else {
            isIsnot = slotValues.IsIsnot.resolved;
        }
        if (handlerInput.requestEnvelope.request.intent.slots.allergen === undefined) {
            say = 'Allergen not identified';
        } else {
            allergen = handlerInput.requestEnvelope.request.intent.slots.allergen.value;
        }
        
        for(var i in dinnerMenu){
            if(isIsnot == "is") {
                if(dinnerMenu[i].allergens.includes(allergen.toUpperCase())){
                    say+=dinnerMenu[i].name + ", ";    
                }
            } 
            if(isIsnot == "isn't") {
                if(!dinnerMenu[i].allergens.includes(allergen.toUpperCase())){
                    say+=dinnerMenu[i].name + ", ";    
                }
            }
            
        }
        
        return responseBuilder
            .speak(say)
            .reprompt('try again, ' + say)
            .getResponse();
    },
};

//FilterByPrice_Handler: allows guest to filter items based on a price
//Author: Zack.
const FilterByPrice_Handler = {
   canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'FilterByPrice' ;
    },
    handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        let say = "";
        let overUnder = "";
        let price = '';
        let category = '';
        let itemsInCategory = [];
        if (handlerInput.requestEnvelope.request.intent.slots.overUnder === undefined) {
            say = 'overUnder not identified';
        } else {
            overUnder = handlerInput.requestEnvelope.request.intent.slots.overUnder.value;
        }
        
        if (handlerInput.requestEnvelope.request.intent.slots.price === undefined) {
            say = 'price not identified';
        } else {
            price = handlerInput.requestEnvelope.request.intent.slots.price.value.substring(1);
        }
        
        price = parseFloat(price);
        //if the user specified a category
        if(handlerInput.requestEnvelope.request.intent.slots.category.value !== undefined){
             for(var i in dinnerMenu) {
                if(dinnerMenu[i].category.toLowerCase() ==handlerInput.requestEnvelope.request.intent.slots.category.value.toLowerCase()){
                    itemsInCategory.push(dinnerMenu[i]);
                }
            }   
            
            if(overUnder.toLowerCase() === "under"){
                for(var i in itemsInCategory){
                        if(itemsInCategory[i].price <= price){
                            say+=itemsInCategory[i].name + ", ";    
                        }
                }
            }
            if(overUnder.toLowerCase() === "over"){
                for(var i in itemsInCategory){
                        if(itemsInCategory[i].price >= price){
                            say+=itemsInCategory[i].name + ", ";    
                        }
                }
            }
        }
        //otherwise the user didn't specify a category
        else{
            if(overUnder.toLowerCase() === "under"){
                for(var i in dinnerMenu){
                        if(dinnerMenu[i].price <= price){
                            say+=dinnerMenu[i].name + ", ";    
                        }
                }
            }
        
        
            if(overUnder.toLowerCase() === "over"){
                for(var i in dinnerMenu){
                        if(dinnerMenu[i].price >= price){
                            say+=dinnerMenu[i].name + ", ";    
                        }
                }
            }
            
        }
        
        return responseBuilder
            .speak(say)
            .reprompt('try again, ' + say)
            .getResponse();
    }
};


//written by Amazon default.
const AMAZON_FallbackIntent_Handler =  {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.FallbackIntent' ;
    },
    handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        let previousSpeech = getPreviousSpeechOutput(sessionAttributes);

        return responseBuilder
            .speak('Sorry I didnt catch what you said, ' + stripSpeak(previousSpeech.outputSpeech))
            .reprompt(stripSpeak(previousSpeech.reprompt))
            .getResponse();
    },
};

//written by Amazon default.
const AMAZON_CancelIntent_Handler =  {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.CancelIntent' ;
    },
    handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();


        let say = 'Okay, talk to you later! ';

        return responseBuilder
            .speak(say)
            .withShouldEndSession(true)
            .getResponse();
    },
};

//written by Amazon default.
const AMAZON_HelpIntent_Handler =  {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.HelpIntent' ;
    },
    handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        let intents = getCustomIntents();
        let sampleIntent = randomElement(intents);

        let say = ' '; 

        say += ' Here something you can ask me: read menu, get the price or description an item, add something to your order, get the price of your order, filter items by price or allergen, and clear or place your order ';

        return responseBuilder
            .speak(say)
            .reprompt('try again, ' + say)
            .getResponse();
    },
};

//written by Amazon default.
const AMAZON_StopIntent_Handler =  {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.StopIntent' ;
    },
    handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();


        let say = 'Okay, talk to you later! ';

        return responseBuilder
            .speak(say)
            .withShouldEndSession(true)
            .getResponse();
    },
};

//written by Amazon default.
const AMAZON_NavigateHomeIntent_Handler =  {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.NavigateHomeIntent' ;
    },
    handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        let say = 'Hello from AMAZON.NavigateHomeIntent. ';


        return responseBuilder
            .speak(say)
            .reprompt('try again, ' + say)
            .getResponse();
    },
};

//ReadMenu_Handler: will read back the items in a category or entire menu.
//Author: Alexa Development team.
const ReadMenu_Handler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' && request.intent.name === 'ReadMenu';
  },
  async handle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    const responseBuilder = handlerInput.responseBuilder;
    let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();


    let slotStatus = '';
    let resolvedSlot;

    let slotValues = getSlotValues(request.intent.slots);

    var catString = await ListOfCategories();
    var say = '';

    say = "Here are the categories on the menu: "+ catString + ". Try requesting a certain category to be read.";


    // getSlotValues returns .heardAs, .resolved, and .isValidated for each slot, according to request slot status codes ER_SUCCESS_MATCH, ER_SUCCESS_NO_MATCH, or traditional simple request slot without resolutions

    //   SLOT: category 
    if (slotValues.category.ERstatus === 'ER_SUCCESS_MATCH') {
    var elseMenu = dinnerMenu.filter(item => item.category.toLowerCase() === slotValues.category.resolved.toLowerCase()).map(item => item.name).join(", ");
        say = "Here are the " + slotValues.category.resolved + " I found: " + elseMenu;
    };

    //This never gets triggered because she just doesn't recognize a category
    if (slotValues.category.ERstatus === 'ER_SUCCESS_NO_MATCH') {
      //WILL HAVE TO SEE IF WE CAN EVEN FIND A MATCH ON THE MENU OF THE CATEGORY
      var elseMenu = dinnerMenu.filter(item => item.category.toLowerCase() === slotValues.category.heardAs.toLowerCase()).map(item => item.name).join(", ");
      if (elseMenu.length > 0) {
        say = "Here are the " + slotValues.category.heardAs + " I found: " + elseMenu
      } else {
        say = "I found no " + slotValues.category.heardAs + " items";
      }
    };

    say = say.substring(0, 100);
    return responseBuilder
      .speak(say)
      .reprompt(say)
      .getResponse()
  }
};


//Pricing_Handler: Gets the price of a slotValue.
//Author: Jack,Max.
const Pricing_Handler =  {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'Pricing' ;
    },
    handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        
        let slotValues = getSlotValues(request.intent.slots); 
        let say = '';

        let slotStatus = '';
        let resolvedSlot;


            say = "$"+GetPrice(FindItem(slotValues.item.heardAs));


        if (slotValues.category.ERstatus === 'ER_SUCCESS_MATCH') {
            say = dinnerMenu.filter(item => item.category.toLowerCase() === slotValues.category.resolved).map(item => {
                return item.name + " is $" + item.price;
            }).join(", ");
        }
        if (slotValues.category.ERstatus === 'ER_SUCCESS_NO_MATCH') {
            var elseMenu = dinnerMenu.filter(item => item.category.toLowerCase() === slotValues.category.heardAs).map(item => {
                    return item.name + " is $" + item.price;
                }).join(", ");
            say = elseMenu.length > 0 ? elseMenu : "I found no " + slotValues.category.heardAs + " items";
        }

        //still just for testing if unwanted scripts run
        say += slotStatus;

        return responseBuilder
            .speak(say)
            .reprompt('try again, ' + say)
            .getResponse();
    },
};

//GetDescription_Handler: Gets the price of an item.
//Author: Jack,Max.
const GetDescription_Handler =  {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'GetDescription' ;
    },
    handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        
        let slotValues = getSlotValues(request.intent.slots); 
        let say = '';

        let slotStatus = '';
        let resolvedSlot;


            say = GetDescription(FindItem(slotValues.item.heardAs));


        return responseBuilder
            .speak(say)
            .reprompt('try again, ' + say)
            .getResponse();
    },
};


//BuildOrder_Handler: builds up an order to send to the chef.
//Author: Zack, Max.
const BuildOrder_Handler =  {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'BuildOrder' ;
    },
    handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        
        let slotValues = getSlotValues(request.intent.slots); 
        //fromIntent = request.intent.name;
        let say = 'and error occured';

        let slotStatus = '';
        let resolvedSlot;


        if (slotValues.item.ERstatus === 'ER_SUCCESS_MATCH') {
            //AddToOrder(FindItem(slotValues.item.resolved));
            //say = "successfully added " +slotValues.item.heardAs +" to order.";
            currentItem = FindItem(slotValues.item.resolved);
            say = "Would you like to add any modifications to " + currentItem.name + "?"
        }
        if (slotValues.item.ERstatus === 'ER_SUCCESS_NO_MATCH') {
            if(FindItem(slotValues.item.heardAs)!=undefined){
                //AddToOrder(FindItem(slotValues.item.heardAs));
                //say = "successfully added " +slotValues.item.heardAs +" to order.";
                currentItem = FindItem(slotValues.item.heardAs);
                say = "Would you like to add any modifications to " + currentItem.name + "?"

            }
            else{
                say = "I could not find "+slotValues.item.heardAs+ " on the menu."
            }
            //slotStatus += 'which did not match any slot value. ';
            //console.log('***** consider adding "' + slotValues.item.heardAs + '" to the custom slot type used by slot item! '); 
        }

        //still just for testing if unwanted scripts run
        

        return responseBuilder
            .speak(say + " Would you like to add any modifications to " + currentItem.name + "?")
            .reprompt("Would you like to add any modifications to " + currentItem.name + "?")
            .getResponse();
    },
};

//ModifyItem_Handler: Adds a modification to the items in an order.
//Author: Max
const ModifyItem_Handler =  {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'ModifyItem' ;
    },
    handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        
        let slotValues = getSlotValues(request.intent.slots); 
        let say = '';

        let slotStatus = '';
        let resolvedSlot;
        

                    if (currentItem.mod === undefined){
                        currentItem.mod = slotValues.mod.heardAs;
                    }
                    else{
                        currentItem.mod += " and "+slotValues.mod.heardAs;
                    }
                    //AddToOrder(currentItem);
                    say = "You added " +slotValues.mod.heardAs+ " to " + currentItem.name + ". Would you like to make any additional modifications?";
                    

        return responseBuilder
            .speak(say)
            .reprompt('try again, ' + say)
            .getResponse();
    },
};


//PlaceOrder_Handler:Places an order to the chef.
//Author:Alexa Development team.
const PlaceOrder_Handler =  {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'PlaceOrder' ;
    },
    handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        //build up the ticket object that would then be sent to the kitchen if the yes intent is invoked
        //then send it to the kitchen under the yes intent
        
        //let ids = "";
        
        //capitalized to 
        let orderItems = [];
        if(currentOrder.length !== 0){
            for(var i =0; i < currentOrder.length; i++){
                orderItems[i] = {
                    "menuItemID": currentOrder[i].itemID,
                    "notes": currentOrder[i].mod
                }
               // ids += currentOrder[i].itemID + ", ";
            }            
        }
        //orderItems will then be added to the ticket that we send off with the table number, restaurant id ...


        let say = "Your order consists of " + ReadCurrentOrder() + " . Are you ready to send your order to the kitchen?";// + " Item ids are: "+ids;
        
        
        return responseBuilder
            .speak(say)
            .reprompt('try again, ' + say)
            .getResponse();
    },
};
//PriceOfOrder_Handler:iterates through the current order and gives the total price.
//Author:Jack,Max.
const PriceOfOrder_Handler =  {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'PriceOfOrder' ;
    },
    handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        
        let currentPrice = 0;
        currentOrder.forEach(item => {
            currentPrice += item.price;
        });

        let say = "The current price of your order is $" + currentPrice;


        return responseBuilder
            .speak(say)
            .reprompt('try again, ' + say)
            .getResponse();
    },
};

//ReadCurrentOrder_Handler:Reads back the number of items in the current order.
//Author:Jack, Max.
const ReadCurrentOrder_Handler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'ReadCurrentOrder' ;
    },
    async handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        let say = ReadCurrentOrder();
        //say = await fetch("https://showcase.linx.twenty57.net:8081/UnixTime/tounixtimestamp?datetime=now");
        //say = await say.json();

        return responseBuilder
            .speak(say)
            .reprompt('try again, ' + say)
            .getResponse();
    },
};

// RestaurantRegistration_Handler: Ellicit the restuarant id for registration
//Author: Ben
const RestaurantRegistration_Handler =  {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'RestaurantRegistration';
    },
    handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        
        let slotValues = getSlotValues(request.intent.slots); 
        let say = '';

        let slotStatus = '';
        let resolvedSlot;
        
        restaurantID = slotValues.restaurantID.heardAs;
        
        say = "You said restaurant " + restaurantID +". What table number would you like to register to?";

        return responseBuilder
            .addElicitSlotDirective('tableNumber', {
                name: 'TableRegistration',
                confirmationStatus: 'NONE',
                slots: {}
            })
            .speak(say)
            .reprompt(say)
            .getResponse();
    },
};

// TableRegistration_Handler: Ellicit the table number for registration
//Author: Ben
const TableRegistration_Handler =  {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'TableRegistration';
    },
    async handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        
        let slotValues = getSlotValues(request.intent.slots); 
        let say = '';

        let slotStatus = '';
        let resolvedSlot;
        
        tableNum = slotValues.tableNumber.heardAs;
        
        say = "Registering to restuarant " + restaurantID +" and table number " + tableNum + ". Please relaunch Auto Garcon.";

        // register these to the database
        var registerEndpoint = "/api/restaurant/"+restaurantID+"/tables/"+tableNum+"/register"

        await httpsPost(registerEndpoint,{"alexaID":alexaID});
        
        return responseBuilder
            .speak(say)
            .reprompt(say)
            .withShouldEndSession(true)
            .getResponse();
    },
};

//ClearOrder_Handler: Deletes all items in the current order.
//Author:Jack, Max.
const ClearOrder_Handler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'ClearOrder' ;
    },
    async handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        let say='';
        if (request.intent.confirmationStatus !== "DENIED") {
            currentOrder = [];
            say = "Successfully cleared your order";
            var customer = {"customerID":customerID};
            var newOrderPath='/api/restaurant/'+restaurantID+'/tables/'+tableNum+'/order/new';
            await httpsPost(newOrderPath,customer);
        }else{
            say = "Your order is still intact. What else can I do for you?"
        }


        return responseBuilder
            .speak(say)
            .reprompt('try again, ' + say)
            .getResponse();
    },
};

//RemoveItem_Handler:Removes an item from the current order.
//Author:Jack, Max.
const RemoveItem_Handler =  {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'RemoveItem' ;
    },
    handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        
        let slotValues = getSlotValues(request.intent.slots); 
        let say = '';

        let slotStatus = '';
        let resolvedSlot;


        if (slotValues.item.ERstatus === 'ER_SUCCESS_MATCH') {

            if (RemoveFromOrder(FindItem(slotValues.item.resolved))) {
                say = "successfully removed " +slotValues.item.heardAs +" from order";
            } else {
                say = "I could not find " + slotValues.item.heardAs +" in your order";
            }
        }
        if (slotValues.item.ERstatus === 'ER_SUCCESS_NO_MATCH') {
            //RemoveFromOrder(FindItem(slotValues.item.heardAs));
            if (RemoveFromOrder(FindItem(slotValues.item.heardAs))) {
                say = "successfully removed " +slotValues.item.heardAs +" from order";
            } else {
                say = "I could not find " + slotValues.item.heardAs +" in your order";
            }
            //slotStatus += 'which did not match any slot value. ';
            console.log('***** consider adding "' + slotValues.item.heardAs + '" to the custom slot type used by slot item! '); 
        }
        
        

        say += slotStatus;


        return responseBuilder
            .speak(say)
            .reprompt('try again, ' + say)
            .getResponse();
    },
};

// LaunchRequest_Handler: fetches data and begins user interaction
//written by Amazon default and Ben
const LaunchRequest_Handler =  {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'LaunchRequest';
    },
    async handle(handlerInput) {
        
        const responseBuilder = handlerInput.responseBuilder;
        let say = '';
        // get alexa id
        //alexaID = handlerInput.requestEnvelope.context.System.device.deviceId.toString();     
        alexaID = "1";
        
        var isRegistered = true;
        // get restaurant id
        await fetch_restaurant(alexaID).then(async result => {
            if (result.restaurantID != null) {
                // get resturantID and table number
                // the device is registered
                restaurantID = result.restaurantID;
                tableNum = result.tableNumber;
                customerID = result.currentOrder.customerID;
                
                // get the restaurant name
                await fetch_restaurant_name(restaurantID).then(result =>{
                  restaurantName = result.restaurantName; 
                });
                
                say = 'Hello and welcome to ' + restaurantName + '!';
                
                if (result.currentOrder.orderItems.length > 0) {
                    // there is an old order
                    // populate the current order
                    for(let i = 0; i < result.currentOrder.orderItems.length ;++i){
                        currentOrder.push(result.currentOrder.orderItems[i]);
                    }
                    
                    say += ' There is an unfinished order. Would you like to resume this order?';
                }
                else {
                    say += ' Say help to hear some options.';
                }
            }
            else {
                isRegistered = false;

            }
        });

        if(isRegistered == false) {
            // the device is not registered
            return responseBuilder
                .addElicitSlotDirective('restaurantID', {
                    name: 'RestaurantRegistration',
                    confirmationStatus: 'NONE',
                    slots: {}
                })
                .speak('The device does not appear to be registered. What restaurant I.D. would you like to register it to?')
                .reprompt('I did not catch that. What restaurant I.D. would you like to register it to?')
                .getResponse()
        }
        
        // get data
        await fetch_data(restaurantID).then(result => {
            for (var i = 0; i < result.length; i++) {
                for (var j = 0; j < result[i].menuItems.length; j++) {
                    dinnerMenu.push(result[i].menuItems[j]);
                };
            };
        });
        
        return responseBuilder
            .speak(say)
            .reprompt('try again, ' + say)
            .getResponse();
    }
};

//written by Amazon default
const SessionEndedHandler =  {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);
        return handlerInput.responseBuilder.getResponse();
    }
};

//written by Amazon default.
const ErrorHandler =  {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        const request = handlerInput.requestEnvelope.request;

        console.log(`Error handled: ${error.message}`);
        // console.log(`Original Request was: ${JSON.stringify(request, null, 2)}`);

        return handlerInput.responseBuilder
            .speak('Sorry, an error occurred.  Please say again.')
            .reprompt('Sorry, an error occurred.  Please say again.')
            .getResponse();
    }
};

//AMAZON_YesIntent_Handler:Gets "yes" responses and redirects from what was the previous intent
//Author: Max
const AMAZON_YesIntent_Handler =  {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.YesIntent' ;
    },
    async handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        let say = 'You said Yes. ';
        let previousIntent = getPreviousIntent(sessionAttributes);
        say +=previousIntent
        if (previousIntent=="BuildOrder" && !handlerInput.requestEnvelope.session.new) {
            say = 'What modifications would you like to make? ';
            return responseBuilder
                .addElicitSlotDirective('mod', {
                    name: 'ModifyItem',
                    confirmationStatus: 'NONE'
                })
                .speak(say)
                .reprompt('try again, ' + say)
                .getResponse();
        }
        if (previousIntent=="ModifyItem" && !handlerInput.requestEnvelope.session.new) {
            say = 'What other modifications would you like to make? ';
            return responseBuilder
                .addElicitSlotDirective('mod', {
                    name: 'ModifyItem',
                    confirmationStatus: 'NONE'
                })
                .speak(say)
                .reprompt('try again, ' + say)
                .getResponse();
        }
        if (previousIntent=="AMAZON.NoIntent" && !handlerInput.requestEnvelope.session.new) {
            say = ' ';
            return responseBuilder
                .addDelegateDirective({
                    name: 'PlaceOrder',
                    confirmationStatus: 'NONE'
                })
                .speak(say)
                .reprompt('try again, ' + say)
                .getResponse();
        }
        if (previousIntent=="PlaceOrder" && !handlerInput.requestEnvelope.session.new) {
            //DO ALL THE CODE TO SEND THE ORDER RIGHT HERE, maybe build it up in place order, but send it after confirmation
            var submitOrderPath = '/api/restaurant/'+restaurantID+'/tables/'+tableNum+'/order/submit';
            await httpsGet(submitOrderPath);
            say = ' Order confirmed and sent to kitchen';
            currentOrder=[];
            return responseBuilder
                .speak(say)
                .reprompt('try again, ' + say)
                .getResponse();
        }

        if (previousIntent=="LaunchRequest" && !handlerInput.requestEnvelope.session.new) {
            say = "Ok. Lets resume your order.";
            return responseBuilder
                .speak(say)
                .reprompt(say)
                .getResponse();
        }

        return responseBuilder
            .speak(say)
            .reprompt('try again, ' + say)
            .getResponse();
    },
};

//AMAZON_NoIntent_Handler:Gets "no" responses and redirects from what was the previous intent
//Author: Max
const AMAZON_NoIntent_Handler =  {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.NoIntent' ;
    },
    async handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        let say = 'You said No. ';
        let previousIntent = getPreviousIntent(sessionAttributes);
        
        if (previousIntent=="BuildOrder" && !handlerInput.requestEnvelope.session.new) {
            // say += 'Your last intent was ' + previousIntent + '. ';
            AddToOrder(currentItem);
            say = "Okay. Successfully added " +currentItem.name +" to order.";
            say += " Are you ready to place your order?";

        }
        if (previousIntent=="ModifyItem" && !handlerInput.requestEnvelope.session.new) {
            // say += 'Your last intent was ' + previousIntent + '. ';
            AddToOrder(currentItem);
            say = "Okay. Successfully added " +currentItem.name + " with " + currentItem.mod + " to order."
            say += " Are you ready to place your order?";
        }
        if (previousIntent=="AMAZON.NoIntent" && !handlerInput.requestEnvelope.session.new) {
            say = 'Okay. What else can I do for you?';
        }
        if (previousIntent=="PlaceOrder" && !handlerInput.requestEnvelope.session.new) {
            // say += 'Your last intent was ' + previousIntent + '. ';
            say = "Okay. Feel free to continue modifying your order. Just say Place Order when you're ready to send it to the kitchen."
        }
        
        if (previousIntent=="LaunchRequest" && !handlerInput.requestEnvelope.session.new) {
            say = "Ok. Lets start a new order";
            currentOrder = [];
            // update the db
            var customer = {"customerID":customerID};
            var newOrderPath='/api/restaurant/'+restaurantID+'/tables/'+tableNum+'/order/new';
            await httpsPost(newOrderPath,customer);
        }
        
        return responseBuilder
            .speak(say)
            .reprompt('try again, ' + say)
            .getResponse();
    },
};

// 2. Constants ===========================================================================

    // Here you can define static data, to be used elsewhere in your code.  For example: 
    //    const myString = "Hello World";
    //    const myArray  = [ "orange", "grape", "strawberry" ];
    //    const myObject = { "city": "Boston",  "state":"Massachusetts" };

const APP_ID = undefined;  // TODO replace with your Skill ID (OPTIONAL).

// 3.  Helper Functions ===================================================================
//written by Amazon default.
function capitalize(myString) {

     return myString.replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); }) ;
}
//written by Amazon default.
function randomElement(myArray) { 
    return(myArray[Math.floor(Math.random() * myArray.length)]); 
} 
 
 //written by Amazon default.
function stripSpeak(str) { 
    return(str.replace('<speak>', '').replace('</speak>', '')); 
} 
 
 
 
 //written by Amazon default.
function getSlotValues(filledSlots) { 
    const slotValues = {}; 
 
    Object.keys(filledSlots).forEach((item) => { 
        const name  = filledSlots[item].name; 
 
        if (filledSlots[item] && 
            filledSlots[item].resolutions && 
            filledSlots[item].resolutions.resolutionsPerAuthority[0] && 
            filledSlots[item].resolutions.resolutionsPerAuthority[0].status && 
            filledSlots[item].resolutions.resolutionsPerAuthority[0].status.code) { 
            switch (filledSlots[item].resolutions.resolutionsPerAuthority[0].status.code) { 
                case 'ER_SUCCESS_MATCH': 
                    slotValues[name] = { 
                        heardAs: filledSlots[item].value, 
                        resolved: filledSlots[item].resolutions.resolutionsPerAuthority[0].values[0].value.name, 
                        ERstatus: 'ER_SUCCESS_MATCH' 
                    }; 
                    break; 
                case 'ER_SUCCESS_NO_MATCH': 
                    slotValues[name] = { 
                        heardAs: filledSlots[item].value, 
                        resolved: '', 
                        ERstatus: 'ER_SUCCESS_NO_MATCH' 
                    }; 
                    break; 
                default: 
                    break; 
            } 
        } else { 
            slotValues[name] = { 
                heardAs: filledSlots[item].value, 
                resolved: '', 
                ERstatus: '' 
            }; 
        } 
    }, this); 
 
    return slotValues; 
} 
 //written by Amazon default.
function supportsDisplay(handlerInput) // returns true if the skill is running on a device with a display (Echo Show, Echo Spot, etc.) 
{                                      //  Enable your skill for display as shown here: https://alexa.design/enabledisplay 
    const hasDisplay = 
        handlerInput.requestEnvelope.context && 
        handlerInput.requestEnvelope.context.System && 
        handlerInput.requestEnvelope.context.System.device && 
        handlerInput.requestEnvelope.context.System.device.supportedInterfaces && 
        handlerInput.requestEnvelope.context.System.device.supportedInterfaces.Display; 
 
    return hasDisplay; 
}
 //written by Amazon default.
function getCustomIntents() { 
    const modelIntents = model.interactionModel.languageModel.intents; 
 
    let customIntents = []; 
 
 
    for (let i = 0; i < modelIntents.length; i++) { 
 
        if(modelIntents[i].name.substring(0,7) != "AMAZON." && modelIntents[i].name !== "LaunchRequest" ) { 
            customIntents.push(modelIntents[i]); 
        } 
    } 
    return customIntents; 
} 
 //written by Amazon default.
function getSampleUtterance(intent) { 
 
    return randomElement(intent.samples); 
 
} 
 //written by Amazon default.
function getPreviousIntent(attrs) { 
 
    if (attrs.history && attrs.history.length > 1) { 
        return attrs.history[attrs.history.length - 2].IntentRequest; 
 
    } else { 
        return false; 
    } 
 
} 
 //written by Amazon default.
function getPreviousSpeechOutput(attrs) { 
 
    if (attrs.lastSpeechOutput && attrs.history.length > 1) { 
        return attrs.lastSpeechOutput; 
 
    } else { 
        return false; 
    } 
 
} 
 //written by Amazon default.
const InitMemoryAttributesInterceptor = { 
    process(handlerInput) { 
        let sessionAttributes = {}; 
        if(handlerInput.requestEnvelope.session['new']) { 
 
            sessionAttributes = handlerInput.attributesManager.getSessionAttributes(); 
 
            let memoryAttributes = getMemoryAttributes(); 
 
            if(Object.keys(sessionAttributes).length === 0) { 
 
                Object.keys(memoryAttributes).forEach(function(key) {  // initialize all attributes from global list 
 
                    sessionAttributes[key] = memoryAttributes[key]; 
 
                }); 
 
            } 
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes); 
 
 
        } 
    } 
}; 
 //written by Amazon default.
const RequestHistoryInterceptor = { 
    process(handlerInput) { 
 
        const thisRequest = handlerInput.requestEnvelope.request; 
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes(); 
 
        let history = sessionAttributes['history'] || []; 
 
        let IntentRequest = {}; 
        if (thisRequest.type === 'IntentRequest' ) { 
 
            let slots = []; 
 
            IntentRequest = { 
                'IntentRequest' : thisRequest.intent.name 
            }; 
 
            if (thisRequest.intent.slots) { 
 
                for (let slot in thisRequest.intent.slots) { 
                    let slotObj = {}; 
                    slotObj[slot] = thisRequest.intent.slots[slot].value; 
                    slots.push(slotObj); 
                } 
 
                IntentRequest = { 
                    'IntentRequest' : thisRequest.intent.name, 
                    'slots' : slots 
                }; 
 
            } 
 
        } else { 
            IntentRequest = {'IntentRequest' : thisRequest.type}; 
        } 
        if(history.length > maxHistorySize - 1) { 
            history.shift(); 
        } 
        history.push(IntentRequest); 
 
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes); 
 
    } 
 
}; 
 
 
 
 //written by Amazon default.
const RequestPersistenceInterceptor = { 
    process(handlerInput) { 
 
        if(handlerInput.requestEnvelope.session['new']) { 
 
            return new Promise((resolve, reject) => { 
 
                handlerInput.attributesManager.getPersistentAttributes() 
 
                    .then((sessionAttributes) => { 
                        sessionAttributes = sessionAttributes || {}; 
 
 
                        sessionAttributes['launchCount'] += 1; 
 
                        handlerInput.attributesManager.setSessionAttributes(sessionAttributes); 
 
                        handlerInput.attributesManager.savePersistentAttributes() 
                            .then(() => { 
                                resolve(); 
                            }) 
                            .catch((err) => { 
                                reject(err); 
                            }); 
                    }); 
 
            }); 
 
        } // end session['new'] 
    } 
}; 
 
 //written by Amazon default.
const ResponseRecordSpeechOutputInterceptor = { 
    process(handlerInput, responseOutput) { 
 
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes(); 
        let lastSpeechOutput = { 
            "outputSpeech":responseOutput.outputSpeech.ssml, 
            "reprompt":responseOutput.reprompt.outputSpeech.ssml 
        }; 
 
        sessionAttributes['lastSpeechOutput'] = lastSpeechOutput; 
 
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes); 
 
    } 
}; 
 //written by Amazon default.
const ResponsePersistenceInterceptor = { 
    process(handlerInput, responseOutput) { 
 
        const ses = (typeof responseOutput.shouldEndSession == "undefined" ? true : responseOutput.shouldEndSession); 
 
        if(ses || handlerInput.requestEnvelope.request.type == 'SessionEndedRequest') { // skill was stopped or timed out 
 
            let sessionAttributes = handlerInput.attributesManager.getSessionAttributes(); 
 
            sessionAttributes['lastUseTimestamp'] = new Date(handlerInput.requestEnvelope.request.timestamp).getTime(); 
 
            handlerInput.attributesManager.setPersistentAttributes(sessionAttributes); 
 
            return new Promise((resolve, reject) => { 
                handlerInput.attributesManager.savePersistentAttributes() 
                    .then(() => { 
                        resolve(); 
                    }) 
                    .catch((err) => { 
                        reject(err); 
                    }); 
 
            }); 
 
        } 
 
    } 
}; 
 
 
 
// 4. Exports handler function and setup ===================================================
const skillBuilder = Alexa.SkillBuilders.custom();
exports.handler = skillBuilder
    .addRequestHandlers(
        AMAZON_FallbackIntent_Handler, 
        AMAZON_CancelIntent_Handler, 
        AMAZON_HelpIntent_Handler, 
        AMAZON_StopIntent_Handler, 
        AMAZON_NavigateHomeIntent_Handler, 
        AMAZON_YesIntent_Handler,
        AMAZON_NoIntent_Handler,
        ReadMenu_Handler, 
        Pricing_Handler,
        GetDescription_Handler,
        BuildOrder_Handler, 
        PlaceOrder_Handler, 
        PriceOfOrder_Handler, 
        ReadCurrentOrder_Handler, 
        RemoveItem_Handler,
        FilterByPrice_Handler,
        AllergenFilter_Handler,
        ModifyItem_Handler,
        ClearOrder_Handler,
        LaunchRequest_Handler, 
        SessionEndedHandler,
        RestaurantRegistration_Handler,
        TableRegistration_Handler
    )
    .addErrorHandlers(ErrorHandler)
    .addRequestInterceptors(InitMemoryAttributesInterceptor)
    .addRequestInterceptors(RequestHistoryInterceptor)

   // .addResponseInterceptors(ResponseRecordSpeechOutputInterceptor)

 // .addRequestInterceptors(RequestPersistenceInterceptor)
 // .addResponseInterceptors(ResponsePersistenceInterceptor)

 // .withTableName("askMemorySkillTable")
 // .withAutoCreateTable(true)

    .lambda();


// End of Skill code -------------------------------------------------------------
// Static Language Model for reference

const model = {
    "interactionModel": {
        "languageModel": {
            "invocationName": "auto garcon",
            "modelConfiguration": {
                "fallbackIntentSensitivity": {
                    "level": "LOW"
                }
            },
            "intents": [
                {
                    "name": "AMAZON.FallbackIntent",
                    "samples": []
                },
                {
                    "name": "AMAZON.CancelIntent",
                    "samples": []
                },
                {
                    "name": "AMAZON.HelpIntent",
                    "samples": []
                },
                {
                    "name": "AMAZON.StopIntent",
                    "samples": []
                },
                {
                    "name": "AMAZON.NavigateHomeIntent",
                    "samples": []
                },
                {
                    "name": "ReadMenu",
                    "slots": [
                        {
                            "name": "category",
                            "type": "category"
                        }
                    ],
                    "samples": [
                        "read the {category} menu",
                        "read the {category}",
                        "what do you have for {category}",
                        "what are your {category}",
                        "read me the {category} options",
                        "read me the {category} menu",
                        "read me the {category}",
                        "what's on the menu",
                        "read me the menu",
                        "read menu"
                    ]
                },
                {
                    "name": "Pricing",
                    "slots": [
                        {
                            "name": "item",
                            "type": "item"
                        },
                        {
                            "name": "category",
                            "type": "category"
                        }
                    ],
                    "samples": [
                        "how much are your {category}",
                        "how much is {item}",
                        "how much does {item} cost",
                        "what's the price of {item}"
                    ]
                },
                {
                    "name": "BuildOrder",
                    "slots": [
                        {
                            "name": "item",
                            "type": "item"
                        }
                    ],
                    "samples": [
                        "add {item} to order",
                        "order {item}"
                    ]
                },
                {
                    "name": "PlaceOrder",
                    "slots": [],
                    "samples": [
                        "confirm order",
                        "place my order",
                        "send my order",
                        "send order to kitchen",
                        "place order"
                    ]
                },
                {
                    "name": "PriceOfOrder",
                    "slots": [],
                    "samples": [
                        "what's the total",
                        "how much does this cost",
                        "what's the cost",
                        "how much is all this",
                        "how much is everything",
                        "what is my total at",
                        "how much is my total",
                        "what's the total cost",
                        "total cost",
                        "how much does my food cost",
                        "how much is my meal",
                        "what's my total",
                        "order price",
                        "current price",
                        "what is the current price of my order"
                    ]
                },
                {
                    "name": "ReadCurrentOrder",
                    "slots": [],
                    "samples": [
                        "what am I ordering",
                        "what's my order",
                        "read the order",
                        "read me my order",
                        "read me back my order",
                        "what is in the order",
                        "what items are in the order",
                        "what items are in my order",
                        "what is my order",
                        "what's in my order"
                    ]
                },
                {
                    "name": "RemoveItem",
                    "slots": [
                        {
                            "name": "item",
                            "type": "item"
                        }
                    ],
                    "samples": [
                        "I don't want {item}",
                        "get rid of {item}",
                        "delete {item}",
                        "remove {item}",
                        "remove {item} from order"
                    ]
                },
                {
                    "name": "FilterByPrice",
                    "slots": [
                        {
                            "name": "overUnder",
                            "type": "overUnder"
                        },
                        {
                            "name": "price",
                            "type": "price"
                        },
                        {
                            "name": "category",
                            "type": "category"
                        }
                    ],
                    "samples": [
                        "what {category} are {overUnder} {price}",
                        "what items are {overUnder} {price}",
                        "get me the items {overUnder} {price}",
                        "test FilterByPrice {price}",
                        "what are the items {overUnder} {price}"
                    ]
                },
                {
                    "name": "AllergenFilter",
                    "slots": [
                        {
                            "name": "allergen",
                            "type": "allergen",
                            "samples": [
                                "vegan"
                            ]
                        }
                    ],
                    "samples": [
                        "what doesn't contain {allergen}",
                        "what isn't {allergen}",
                        "get me everything that is not {allergen}",
                        "filter based on {allergen}"
                    ]
                },
                {
                    "name": "GetDescription",
                    "slots": [
                        {
                            "name": "item",
                            "type": "item"
                        }
                    ],
                    "samples": [
                        "what is in {item}",
                        "what is on {item}",
                        "describe {item}",
                        "tell me about {item}"
                    ]
                },
                {
                    "name": "ModifyItem",
                    "slots": [
                        {
                            "name": "mod",
                            "type": "AMAZON.Food"
                        },
                        {
                            "name": "item",
                            "type": "item"
                        }
                    ],
                    "samples": [
                        "can I add {mod} to {item}",
                        "I want {mod} on {item}",
                        "can I get {mod} on {item}",
                        "can I get {mod} on the {item}",
                        "I want to add {mod} to {item}",
                        "I want to add {mod}",
                        "{mod}",
                        "add {mod}",
                        "add {mod} to {item}"
                    ]
                },
                {
                    "name": "ClearOrder",
                    "slots": [],
                    "samples": [
                        "start my order over",
                        "scratch everything",
                        "clear everything",
                        "delete order",
                        "clear my current order",
                        "clear order"
                    ]
                },
                {
                    "name": "AMAZON.YesIntent",
                    "samples": []
                },
                {
                    "name": "AMAZON.NoIntent",
                    "samples": []
                }
            ],
            "types": [
                {
                    "name": "category",
                    "values": [
                        {
                            "name": {
                                "value": "Drinks",
                                "synonyms": [
                                    "beverages"
                                ]
                            }
                        },
                        {
                            "name": {
                                "value": "Appetizers",
                                "synonyms": [
                                    "apps"
                                ]
                            }
                        },
                        {
                            "name": {
                                "value": "Burgers",
                                "synonyms": [
                                    "burger"
                                ]
                            }
                        },
                        {
                            "name": {
                                "value": "Wraps",
                                "synonyms": [
                                    "raps"
                                ]
                            }
                        },
                        {
                            "name": {
                                "value": "Entrees",
                                "synonyms": [
                                    "Entree"
                                ]
                            }
                        },
                        {
                            "name": {
                                "value": "Wings"
                            }
                        },
                        {
                            "name": {
                                "value": "Paninis"
                            }
                        },
                        {
                            "name": {
                                "value": "Hot Sandwhiches"
                            }
                        },
                        {
                            "name": {
                                "value": "Salads"
                            }
                        },
                        {
                            "name": {
                                "value": "Street Tacos"
                            }
                        }
                    ]
                },
                {
                    "name": "item",
                    "values": [
                        {
                            "name": {
                                "value": "Cheese Curds"
                            }
                        },
                        {
                            "name": {
                                "value": "Mini Tacos"
                            }
                        },
                        {
                            "name": {
                                "value": "Black Bean Burger"
                            }
                        },
                        {
                            "name": {
                                "value": "Cowboy"
                            }
                        },
                        {
                            "name": {
                                "value": "California"
                            }
                        },
                        {
                            "name": {
                                "value": "Classic Hamburger"
                            }
                        },
                        {
                            "name": {
                                "value": "Double"
                            }
                        },
                        {
                            "name": {
                                "value": "Turkey"
                            }
                        },
                        {
                            "name": {
                                "value": "Tex-Mex"
                            }
                        },
                        {
                            "name": {
                                "value": "Peanut Butter Bacon"
                            }
                        },
                        {
                            "name": {
                                "value": "Gouda Bacon"
                            }
                        },
                        {
                            "name": {
                                "value": "Cesar Wrap"
                            }
                        },
                        {
                            "name": {
                                "value": "Zesty Melt"
                            }
                        },
                        {
                            "name": {
                                "value": "Quesadilla"
                            }
                        },
                        {
                            "name": {
                                "value": "Blooming Onion"
                            }
                        },
                        {
                            "name": {
                                "value": "Onion Rings"
                            }
                        },
                        {
                            "name": {
                                "value": "French Fries"
                            }
                        },
                        {
                            "name": {
                                "value": "Nachos"
                            }
                        },
                        {
                            "name": {
                                "value": "Chicken Strips"
                            }
                        },
                        {
                            "name": {
                                "value": "Teriaki Wings"
                            }
                        },
                        {
                            "name": {
                                "value": "Samurai Wings"
                            }
                        },
                        {
                            "name": {
                                "value": "Traditional Tots"
                            }
                        },
                        {
                            "name": {
                                "value": "Ranch Tots"
                            }
                        },
                        {
                            "name": {
                                "value": "Cajun Tots"
                            }
                        },
                        {
                            "name": {
                                "value": "Chicken Strips"
                            }
                        },
                        {
                            "name": {
                                "value": "Buffalo Strips"
                            }
                        },
                        {
                            "name": {
                                "value": "Mozzarella Sticks"
                            }
                        },
                        {
                            "name": {
                                "value": "Cheese Quesadilla"
                            }
                        },
                        {
                            "name": {
                                "value": "Chicken Quesadilla"
                            }
                        },
                        {
                            "name": {
                                "value": "Loaded Nachos"
                            }
                        },
                        {
                            "name": {
                                "value": "Grilled Cheese"
                            }
                        },
                        {
                            "name": {
                                "value": "Caprese Grilled Cheese"
                            }
                        },
                        {
                            "name": {
                                "value": "Chicken Avocado"
                            }
                        },
                        {
                            "name": {
                                "value": "Chicken Parmesan"
                            }
                        },
                        {
                            "name": {
                                "value": "Italian"
                            }
                        },
                        {
                            "name": {
                                "value": "Italian"
                            }
                        },
                        {
                            "name": {
                                "value": "Bacon Chicken Ranch"
                            }
                        },
                        {
                            "name": {
                                "value": "Bacon Chicken Chipotle"
                            }
                        },
                        {
                            "name": {
                                "value": "Chicken Caesar"
                            }
                        },
                        {
                            "name": {
                                "value": "Mandarin Chicken"
                            }
                        },
                        {
                            "name": {
                                "value": "Firecracker"
                            }
                        },
                        {
                            "name": {
                                "value": "Bacon Chicken Ranch"
                            }
                        },
                        {
                            "name": {
                                "value": "Bacon Chicken Chipotle"
                            }
                        },
                        {
                            "name": {
                                "value": "Chicken Caesar"
                            }
                        },
                        {
                            "name": {
                                "value": "Mandarin Chicken"
                            }
                        },
                        {
                            "name": {
                                "value": "Firecracker"
                            }
                        },
                        {
                            "name": {
                                "value": "House"
                            }
                        },
                        {
                            "name": {
                                "value": "Pork Carnitas"
                            }
                        },
                        {
                            "name": {
                                "value": "Beef Barbacoa"
                            }
                        }
                    ]
                },
                {
                    "name": "overUnder",
                    "values": [
                        {
                            "name": {
                                "value": "under",
                                "synonyms": [
                                    "up to",
                                    "below",
                                    "less than"
                                ]
                            }
                        },
                        {
                            "name": {
                                "value": "over",
                                "synonyms": [
                                    "just over",
                                    "above",
                                    "more than"
                                ]
                            }
                        }
                    ]
                },
                {
                    "name": "price",
                    "values": [
                        {
                            "name": {
                                "value": "fifteen dollars"
                            }
                        },
                        {
                            "name": {
                                "value": "one dollar"
                            }
                        },
                        {
                            "name": {
                                "value": "5 dollars"
                            }
                        },
                        {
                            "name": {
                                "value": "nine and a half dollars",
                                "synonyms": [
                                    "9.50",
                                    "$9.50"
                                ]
                            }
                        },
                        {
                            "name": {
                                "value": "one hundred dollars"
                            }
                        },
                        {
                            "name": {
                                "value": "ten dollars",
                                "synonyms": [
                                    "10",
                                    "10 dollars",
                                    "$10"
                                ]
                            }
                        }
                    ]
                },
                {
                    "name": "allergen",
                    "values": [
                        {
                            "name": {
                                "value": "vegan"
                            }
                        },
                        {
                            "name": {
                                "value": "gluten free"
                            }
                        }
                    ]
                },
                {
                    "name": "AMAZON.Food",
                    "values": [
                        {
                            "name": {
                                "value": "extra mushrooms"
                            }
                        },
                        {
                            "name": {
                                "value": "extra pickles"
                            }
                        },
                        {
                            "name": {
                                "value": "double meat"
                            }
                        },
                        {
                            "name": {
                                "value": "extra bacon"
                            }
                        },
                        {
                            "name": {
                                "value": "extra onions"
                            }
                        },
                        {
                            "name": {
                                "value": "extra cheese"
                            }
                        },
                        {
                            "name": {
                                "value": "raw"
                            }
                        },
                        {
                            "name": {
                                "value": "well done"
                            }
                        },
                        {
                            "name": {
                                "value": "medium rare"
                            }
                        },
                        {
                            "name": {
                                "value": "rare"
                            }
                        }
                    ]
                }
            ]
        },
        "dialog": {
            "intents": [
                {
                    "name": "AllergenFilter",
                    "delegationStrategy": "SKILL_RESPONSE",
                    "confirmationRequired": false,
                    "prompts": {},
                    "slots": [
                        {
                            "name": "allergen",
                            "type": "allergen",
                            "confirmationRequired": false,
                            "elicitationRequired": true,
                            "prompts": {
                                "elicitation": "Elicit.Slot.458766584741.717883134057"
                            }
                        }
                    ]
                },
                {
                    "name": "ReadMenu",
                    "confirmationRequired": false,
                    "prompts": {},
                    "slots": [
                        {
                            "name": "category",
                            "type": "category",
                            "confirmationRequired": false,
                            "elicitationRequired": false,
                            "prompts": {}
                        }
                    ]
                },
                {
                    "name": "ClearOrder",
                    "confirmationRequired": true,
                    "prompts": {
                        "confirmation": "Confirm.Intent.1294309823697"
                    },
                    "slots": []
                }
            ],
            "delegationStrategy": "ALWAYS"
        },
        "prompts": [
            {
                "id": "Elicit.Slot.458766584741.717883134057",
                "variations": [
                    {
                        "type": "PlainText",
                        "value": "please give an allergen to filter by"
                    }
                ]
            },
            {
                "id": "Elicit.Slot.918377438504.1303097264628",
                "variations": [
                    {
                        "type": "PlainText",
                        "value": "Which category of the menu would you like me to read?"
                    }
                ]
            },
            {
                "id": "Confirm.Intent.1294309823697",
                "variations": [
                    {
                        "type": "PlainText",
                        "value": "Are you sure you would like to clear your current order?"
                    }
                ]
            }
        ]
    }
};