const requestEvent = require('../../event/requestEvent');
const messageEvent = require('../../event/messageEvent');
const triggerEventEmitter = require('./event/triggerEventEmitter');
// const event2Event = require('../../../pubmodules/events/event2Event');
const eventEvent = require('../../pubmodules/events/eventEvent');

var Trigger = require('./models/trigger');
var winston = require('../../config/winston');

var Engine = require('@tiledesk/tiledesk-json-rules-engine').Engine;



var messageService = require('../../services/messageService');
var requestService = require('../../services/requestService');
var MessageConstants = require("../../models/messageConstants");
var leadService = require('../../services/leadService');
var LeadConstants = require('../../models/leadConstants');
var operatingHoursService = require("../../services/operatingHoursService");
var sendMessageUtil = require("../../utils/sendMessageUtil");
var cacheUtil = require("../../utils/cacheUtil");



const uuidv4 = require('uuid/v4');


class RulesTrigger {

    constructor() {
      // this.engine = new Engine();;
      // this.engine = undefined;
      this.engines = {};
    }

    // getEngine() {
    //   return this.engine;
    // }

    listen(success, error) {
        var that = this;

        var enabled = process.env.TRIGGER_ENABLED || "true";
        winston.debug('Trigger enabled:'+enabled);

        if (enabled==="true") {
          winston.debug('Trigger enabled');
        }else {
          winston.info('Trigger disabled');
          return 0;
        }


     setImmediate(() => {

          requestEvent.on('request.support_group.created', function(request) {
            // requestEvent.on('request.create', function(request) {
            var requestJson = request.toJSON();
            operatingHoursService.projectIsOpenNow(request.id_project, function (isOpen, err) {       
              requestJson.isOpen = isOpen;
              winston.debug('requestJson: ', requestJson);
              that.exec(requestJson, 'request.create', success, error);
            });
          });

          requestEvent.on('request.participants.join',  function(data) {      
            let request = data.request;
            let member = data.member;
            var requestJson = request.toJSON();
            operatingHoursService.projectIsOpenNow(request.id_project, function (isOpen, err) {       
              requestJson.isOpen = isOpen;
              winston.debug('requestJson: ', requestJson);
              that.exec(requestJson, 'request.participants.join', success, error);
            });
          });

          messageEvent.on('message.create.from.requester', function(message) {
            winston.debug('message.create.from.requester', message);
            // aggiungi is open anche a message.create altrimenti isOpen nn va
            // operatingHoursService.projectIsOpenNow(request.id_project, function (isOpen, err) {   
            that.exec(message, 'message.create.from.requester', success, error);
          });
  // not in use
          // messageEvent.on('message.received', function(request) {
          //   that.exec(request, 'message.received', success, error);
          // });

          // event2Event.on('*', function(event){
          //   winston.verbose('event2Event this.event: ' + this.event);
          //   that.exec(event, this.event, success,error);
          // });

          eventEvent.on('event.emit', function(event) {
            winston.debug('eventEvent event.emit', event);
            that.exec(event, 'event.emit', success,error);
          });

        
        
          this.runAction();

          winston.info('Trigger rules started');

      });

    }

    runAction() {

      triggerEventEmitter.on('message.send', function(eventTrigger) {

        try {

          winston.debug('runAction eventTrigger.eventSuccess:', eventTrigger.eventSuccess);
          var trigger = eventTrigger.trigger;         
          winston.debug('runAction trigger', trigger.toObject());


          var action = eventTrigger.action;
          winston.debug('runAction action', action.toObject());

          var fullname = action.parameters.fullName || "BOT";
          winston.debug('runAction action fullname: ' + fullname);

          var sender = "system";
          
          if (action.parameters.sender) {
            sender = action.parameters.sender;
          }
          winston.debug('runAction action sender: ' + sender);

          var text = action.parameters.text;
          winston.debug('runAction action text: ' + text);

          var attributes = {templateProcessor: true};

          // var attributes = action.parameters.attributes;
          // winston.debug('runAction action attributes: ' + attributes);

          if (text && text.endsWith(":tdk_msg_subtype_info")) {            
            attributes.subtype = "info";
            text = text.replace(':tdk_msg_subtype_info', '');
            winston.verbose('tdk_msg_subtype_info');
          }
        

          var recipient;
          if (eventTrigger.eventKey=="request.create" || eventTrigger.eventKey=="request.participants.join") {
            recipient = eventTrigger.event.request_id;
          }
          if (eventTrigger.eventKey=="message.create.from.requester" || eventTrigger.eventKey=="message.received") {
            recipient = eventTrigger.event.recipient;
          }
          if (eventTrigger.eventKey=="event.emit") {
            winston.debug('runAction action event.emit: ', eventTrigger.event.toObject());

            //TODO funziona?
            recipient = eventTrigger.event.project_user.id_user;
          }
          
          winston.debug('runAction action recipient: ' + recipient);

          var id_project = eventTrigger.event.id_project;
          winston.debug('runAction action id_project: ' + id_project);

            // send(sender, senderFullname, recipient, text, id_project, createdBy, attributes) {
            // messageService.send(
            //   sender, 
            //   fullname,                                     
            //   recipient,
            //   text,
            //   id_project,
            //   null,
            //   attributes
            // );
            
            // send(sender, senderFullname, recipient, text, id_project, createdBy, attributes, type, metadata, language) {
            sendMessageUtil.send(
              sender, 
              fullname,
              recipient,
              text,
              id_project,
              null,
              attributes
            );

        } catch(e) {
          winston.error("Error runAction", e);
        }

        });
      




        triggerEventEmitter.on('request.department.route', function(eventTrigger) {

          try {
  
            winston.debug('runAction eventTrigger.eventSuccess:', eventTrigger.eventSuccess);
            var trigger = eventTrigger.trigger;         
            winston.debug('runAction trigger', trigger.toObject());
  
  
            var action = eventTrigger.action;
            winston.debug('runAction action', action.toObject());
    
                
            var departmentid = action.parameters.departmentid;
            winston.debug('runAction action departmentid: ' + departmentid);


            var request_id;
            if (eventTrigger.eventKey=="request.create") {
              request_id = eventTrigger.event.request_id;
            }
            if (eventTrigger.eventKey=="message.create.from.requester" || eventTrigger.eventKey=="message.received") {
              request_id = eventTrigger.event.recipient;
            }
            
            winston.debug('runAction action request_id: ' + request_id);

            var id_project = eventTrigger.event.id_project;
            winston.debug('runAction action id_project: ' + id_project);

            // route(request_id, departmentid, id_project, nobot) {
            requestService.route(request_id, departmentid, id_project);
  
          } catch(e) {
            winston.error("Error runAction", e);
          }
  
        });




          triggerEventEmitter.on('request.department.route.self', function(eventTrigger) {

            try {
    
              winston.debug('runAction eventTrigger.eventSuccess:', eventTrigger.eventSuccess);
              var trigger = eventTrigger.trigger;         
              winston.debug('runAction trigger', trigger.toObject());
    
              var action = eventTrigger.action;
              winston.debug('runAction action', action.toObject());
                           
              var request_id;
              if (eventTrigger.eventKey=="request.create") {
                request_id = eventTrigger.event.request_id;
              }
              if (eventTrigger.eventKey=="message.create.from.requester" || eventTrigger.eventKey=="message.received") {
                request_id = eventTrigger.event.recipient;
              }
              
              winston.debug('runAction action request_id: ' + request_id);
  
              var id_project = eventTrigger.event.id_project;
              winston.debug('runAction action id_project: ' + id_project);
  
              // reroute(request_id, id_project, nobot) {
              requestService.reroute(request_id, id_project);                           
    
            } catch(e) {
              winston.error("Error runAction", e);
            }
    
            });





            triggerEventEmitter.on('request.status.update', function(eventTrigger) {

              try {
      
                winston.debug('runAction eventTrigger.eventSuccess:', eventTrigger.eventSuccess);
                var trigger = eventTrigger.trigger;         
                winston.debug('runAction trigger', trigger.toObject());
      
                var action = eventTrigger.action;
                winston.debug('runAction action', action.toObject());
                       
                var newstatus = action.parameters.status;
                winston.debug('runAction action newstatus: ' + newstatus);

                
                var request_id;
                if (eventTrigger.eventKey=="request.create") {
                  request_id = eventTrigger.event.request_id;
                }
                if (eventTrigger.eventKey=="message.create.from.requester" || eventTrigger.eventKey=="message.received") {
                  request_id = eventTrigger.event.recipient;
                }
                
                winston.debug('runAction action request_id: ' + request_id);
    
                var id_project = eventTrigger.event.id_project;
                winston.debug('runAction action id_project: ' + id_project);
    
                // changeStatusByRequestId(request_id, id_project, newstatus) {
                requestService.changeStatusByRequestId(request_id, id_project, newstatus);                      
      
              } catch(e) {
                winston.error("Error runAction", e);
              }
      
              });






              triggerEventEmitter.on('request.close', function(eventTrigger) {

                try {
        
                  winston.debug('runAction eventTrigger.eventSuccess:', eventTrigger.eventSuccess);
                  var trigger = eventTrigger.trigger;         
                  winston.debug('runAction trigger', trigger.toObject());
        
                  var action = eventTrigger.action;
                  winston.debug('runAction action', action.toObject());
                                             
                      
                  var request_id;
                  if (eventTrigger.eventKey=="request.create") {
                    request_id = eventTrigger.event.request_id;
                  }
                  if (eventTrigger.eventKey=="message.create.from.requester" || eventTrigger.eventKey=="message.received") {
                    request_id = eventTrigger.event.recipient;
                  }
                  
                  winston.debug('runAction action request_id: ' + request_id);
      
                  var id_project = eventTrigger.event.id_project;
                  winston.debug('runAction action id_project: ' + id_project);
      
                  // closeRequestByRequestId(request_id, id_project, skipStatsUpdate, notify, closed_by)
                  const closed_by = "_trigger";
                  requestService.closeRequestByRequestId(request_id, id_project, false, true, closed_by);
                                      
                } catch(e) {
                  winston.error("Error runAction", e);
                }
        
                });



                triggerEventEmitter.on('request.reopen', function(eventTrigger) {

                  try {
          
                    winston.debug('runAction eventTrigger.eventSuccess:', eventTrigger.eventSuccess);
                    var trigger = eventTrigger.trigger;         
                    winston.debug('runAction trigger', trigger.toObject());
          
                    var action = eventTrigger.action;
                    winston.debug('runAction action', action.toObject());
                                               
                        
                    var request_id;
                    if (eventTrigger.eventKey=="request.create") {
                      request_id = eventTrigger.event.request_id;
                    }
                    if (eventTrigger.eventKey=="message.create.from.requester" || eventTrigger.eventKey=="message.received") {
                      request_id = eventTrigger.event.recipient;
                    }
                    
                    winston.debug('runAction action request_id: ' + request_id);
        
                    var id_project = eventTrigger.event.id_project;
                    winston.debug('runAction action id_project: ' + id_project);
        
                    //   reopenRequestByRequestId(request_id, id_project) {
                    requestService.reopenRequestByRequestId(request_id, id_project);                    
          
                  } catch(e) {
                    winston.error("Error runAction", e);
                  }
          
             });



             triggerEventEmitter.on('request.participants.join', function(eventTrigger) {

              try {
      
                winston.debug('runAction eventTrigger.eventSuccess:', eventTrigger.eventSuccess);
                var trigger = eventTrigger.trigger;         
                winston.debug('runAction trigger', trigger.toObject());
      
                var action = eventTrigger.action;
                winston.debug('runAction action', action.toObject());
                             
                // console.log("actionaction",action);

                var member = action.parameters.member;
                winston.debug('runAction action member: ' + member);

                var request_id;
                if (eventTrigger.eventKey=="request.create") {
                  request_id = eventTrigger.event.request_id;
                }
                if (eventTrigger.eventKey=="message.create.from.requester" || eventTrigger.eventKey=="message.received") {
                  request_id = eventTrigger.event.recipient;
                }
                
                winston.debug('runAction action request_id: ' + request_id);
    
                var id_project = eventTrigger.event.id_project;
                winston.debug('runAction action id_project: ' + id_project);
    
                //     addParticipantByRequestId(request_id, id_project, member) {
                requestService.addParticipantByRequestId(request_id, id_project, member);
        
                       
              } catch(e) {
                winston.error("Error runAction", e);
              }
      
         });







         triggerEventEmitter.on('request.department.bot.launch', function(eventTrigger) {

            try {
    
              winston.debug('runAction eventTrigger.eventSuccess:', eventTrigger.eventSuccess);
              var trigger = eventTrigger.trigger;         
              winston.debug('runAction trigger', trigger.toObject());
    
              var action = eventTrigger.action;
              winston.debug('runAction action', action.toObject());
                           
              var request_id;
              if (eventTrigger.eventKey=="request.create") {
                request_id = eventTrigger.event.request_id;
              }
              if (eventTrigger.eventKey=="message.create.from.requester" || eventTrigger.eventKey=="message.received") {
                request_id = eventTrigger.event.recipient;
              }
              
              winston.debug('runAction action request_id: ' + request_id);
  
              var id_project = eventTrigger.event.id_project;
              winston.debug('runAction action id_project: ' + id_project);
  
              // reroute(request_id, id_project, nobot) {
              requestService.reroute(request_id, id_project).then(function(request) {

                winston.verbose('request.department.bot.launch action reroute request_id: ' + request_id);

                // rendi dinamico /start
                messageService.send(
                  'system', 
                  'Bot',                                     
                  request_id,
                  '\\start',
                  id_project,
                  null,
                  {subtype:'info', updateconversation : false}
                );
    
                  // TODO Add typing? 
              })                       
    

            } catch(e) {
              winston.error("Error runAction", e);
            }
    
            });





         
        
            triggerEventEmitter.on('request.bot.launch', function(eventTrigger) {

              try {
      
                winston.debug('runAction eventTrigger.eventSuccess:', eventTrigger.eventSuccess);
                var trigger = eventTrigger.trigger;         
                winston.debug('runAction trigger', trigger.toObject());
      
                var action = eventTrigger.action;
                winston.debug('runAction action', action.toObject());
                             
                var request_id;
                if (eventTrigger.eventKey=="request.create") {
                  request_id = eventTrigger.event.request_id;
                }
                if (eventTrigger.eventKey=="message.create.from.requester" || eventTrigger.eventKey=="message.received") {
                  request_id = eventTrigger.event.recipient;
                }
                winston.debug('runAction action request_id: ' + request_id);


                var member = action.parameters.member;
                winston.debug('runAction action member: ' + member);

    
                var id_project = eventTrigger.event.id_project;
                winston.debug('runAction action id_project: ' + id_project);
    
                 requestService.addParticipantByRequestId(request_id, id_project, member).then(function(request) {
  
                  winston.verbose('request.bot.launch action request_id: ' + request_id);
  
                  // rendi dinamico /start
                  messageService.send(
                    'system', 
                    'Bot',                                     
                    request_id,
                    '\\start',
                    id_project,
                    null,
                    {subtype:'info', updateconversation : false}
                  );
      
                    // TODO Add typing? 
                })                       
      
  
              } catch(e) {
                winston.error("Error runAction", e);
              }
      
              });

              

          triggerEventEmitter.on('request.tags.add', function(eventTrigger) {

              try {
      
                winston.debug('runAction eventTrigger.eventSuccess:', eventTrigger.eventSuccess);
                var trigger = eventTrigger.trigger;         
                winston.debug('runAction trigger', trigger.toObject());
      
                var action = eventTrigger.action;
                winston.debug('runAction action', action.toObject());
                             
                // console.log("actionaction",action);

                var tag = action.parameters.tag;
                winston.debug('runAction action tag: ' + tag);

                var request_id;
                if (eventTrigger.eventKey=="request.create") {
                  request_id = eventTrigger.event.request_id;
                }
                if (eventTrigger.eventKey=="message.create.from.requester" || eventTrigger.eventKey=="message.received") {
                  request_id = eventTrigger.event.recipient;
                }
                
                winston.debug('runAction action request_id: ' + request_id);
    
                var id_project = eventTrigger.event.id_project;
                winston.debug('runAction action id_project: ' + id_project);
    
                // addTagByRequestId(request_id, id_project, tag) {
                requestService.addTagByRequestId(request_id, id_project, {tag:tag});
        
                       
              } catch(e) {
                winston.error("Error runAction", e);
              }
      
         });





         triggerEventEmitter.on('request.participants.leave', function(eventTrigger) {

          try {
  
            winston.debug('runAction eventTrigger.eventSuccess:', eventTrigger.eventSuccess);
            var trigger = eventTrigger.trigger;         
            winston.debug('runAction trigger', trigger.toObject());
  
            var action = eventTrigger.action;
            winston.debug('runAction action', action.toObject());

            var member = action.parameters.member;
            winston.debug('runAction action member: ' + member);

            var request_id;
            if (eventTrigger.eventKey=="request.create") {
              request_id = eventTrigger.event.request_id;
            }
            if (eventTrigger.eventKey=="message.create.from.requester" || eventTrigger.eventKey=="message.received") {
              request_id = eventTrigger.event.recipient;
            }
            
            winston.debug('runAction action request_id: ' + request_id);

            var id_project = eventTrigger.event.id_project;
            winston.debug('runAction action id_project: ' + id_project);

            //     removeParticipantByRequestId(request_id, id_project, member) {
            requestService.removeParticipantByRequestId(request_id, id_project, member);                      
  
          } catch(e) {
            winston.error("Error runAction", e);
          }
  
     });

      

     triggerEventEmitter.on('request.create', function(eventTrigger) {

      try {

          winston.debug('runAction eventTrigger.eventSuccess:', eventTrigger.eventSuccess);

          var trigger = eventTrigger.trigger;         
          winston.debug('runAction trigger', trigger.toObject());

          var action = eventTrigger.action;
          winston.debug('runAction action', action.toObject());


          var text = action.parameters.text;
          winston.debug('runAction action text: ' + text);

          var subtype = action.parameters.subtype;
          winston.debug('runAction action subtype: ' + subtype);;

          var status = action.parameters.status;
          winston.debug('runAction action status: ' + status);


          var preflight = action.parameters.preflight;
          winston.debug('runAction action preflight: ' + preflight);

          if (text && text.indexOf(":tdk_msg_subtype_info")>-1) {
            subtype = "info";
            text = text.replace(':tdk_msg_subtype_info', '');
            winston.debug('tdk_msg_subtype_info');
          }

          if (text && text.indexOf(":tdk_req_status_hidden")>-1) {
            status = 50;
            preflight = true;
            text = text.replace(':tdk_req_status_hidden', '');
            winston.debug('tdk_req_status_hidden');
          }

          var type = action.parameters.type;
          winston.debug('runAction action type: ' + type);

        

         

          var departmentid = action.parameters.departmentid;
          winston.debug('runAction action departmentid: ' + departmentid);

          // var attributes = action.parameters.attributes;
          // winston.debug('runAction action attributes: ' + attributes);

          

          var request_id = 'support-group-'+id_project+"-"+uuidv4();
          var id_user;
          var fullname;
          var email;
          var attributes = {};

          

          var sourcePage;
          var language;
          var userAgent;
          
          var userObj = undefined;


          if (eventTrigger.eventKey=="event.emit") {
              winston.verbose('runAction action event.emit: ', eventTrigger.event);
              //  winston.debug('runAction action event.emit: ', eventTrigger.event.toObject());

              // if (eventTrigger.event.project_user && 
              //   eventTrigger.event.project_user.uuid_user &&
              //   eventTrigger.event.project_user.uuid_user) {
                  id_user = eventTrigger.event.project_user.uuid_user;

                  if (eventTrigger.event.user) {
                    
                    winston.verbose('eventTrigger.event.user: ', eventTrigger.event.user);

                   
                    if (eventTrigger.event.user.toObject) {
                      userObj = eventTrigger.event.user.toObject();
                    }else {
                      userObj = eventTrigger.event.user;
                    }
                    delete userObj.password;


                    if (eventTrigger.event.user.fullName) {
                      fullname = eventTrigger.event.user.fullName;
                      winston.verbose('fullname: '+ fullname);
                    }

                    if (eventTrigger.event.user.email) {
                      email = eventTrigger.event.user.email;
                      winston.verbose('email: '+ email);
                    }

                  }
                
                // }
              

            // if (attributes && attributes.id_user) {
            //   id_user = attributes.id_user;
            // }

            if (eventTrigger.event.attributes) {
              var eventAttributes = eventTrigger.event.attributes;

              if (eventAttributes.request_id) {
                request_id = eventAttributes.request_id;
              }            
              if (eventAttributes.id_user) {
                id_user = eventAttributes.id_user;
              }
              if (eventAttributes.fullname) {
                fullname = eventAttributes.fullname;
              }
              if (eventAttributes.email) {
                email = eventAttributes.email;
              }
             
              if (eventAttributes.language) {
                language = eventAttributes.language;
              }
             
              if (eventAttributes.department) { //TODO Dario change to departmentId
                departmentid = eventAttributes.department;
              }

              if (eventAttributes.text) {
                text = eventAttributes.text;
              }

              if (eventAttributes.status) {
                status = eventAttributes.status;
              }

              if (eventAttributes.subtype) {
                subtype = eventAttributes.subtype;
              }




            

              if (eventAttributes.attributes) {
                attributes = eventAttributes.attributes;



                if (eventAttributes.attributes.client) {
                  userAgent = eventAttributes.attributes.client;  //the widget pass client parameter and not userAgent
                }
                if (eventAttributes.attributes.sourcePage) {
                  sourcePage = eventAttributes.attributes.sourcePage;
                }

              }

              


          }



          if (subtype) {
            attributes.subtype = subtype;
          }

          if (userObj) {
            attributes.decoded_jwt = userObj;
          }           
            

          }

          winston.debug('runAction action id_user:'+id_user); 
          
          

          var id_project = eventTrigger.event.id_project;
          winston.debug('runAction action id_project: ' + id_project);

            
              // createIfNotExistsWithLeadId(lead_id, fullname, email, id_project, createdBy, attributes, status) 
            leadService.createIfNotExistsWithLeadId(id_user, fullname , email, id_project, null, attributes,  LeadConstants.TEMP)
              .then(function(createdLead) {
                 

             


                // return Project_user.findOne(queryProjectUser, function (err, project_user) {

                //   var project_user_id = null; 

                //   if (err) {
                //     winston.error("Error getting the project_user_id", err);
                //   }

                //   if (project_user) {
                //     winston.verbose("project_user", project_user);
                //     project_user_id = project_user.id;
                //     winston.verbose("project_user_id: " + project_user_id);
                //   }


                var puser = eventTrigger.event.project_user;
                var project_user_id = puser._id;   //questo è null se nn specifico come trigger un event
                winston.verbose("project_user_id: " + project_user_id);


                // qui c'è errore c21
                        // createWithIdAndRequester(request_id, project_user_id, lead_id, id_project, first_text, departmentid, sourcePage, 
                        // language, userAgent, status, createdBy, attributes, subject, preflight) {

                          // return requestService.createWithIdAndRequester(request_id, project_user_id, createdLead._id, id_project, 
                          //   text, departmentid, sourcePage, 
                          //   language, userAgent, status, id_user, attributes, undefined, preflight).then(function (savedRequest) {


                    var new_request = {
                      request_id: request_id, project_user_id: project_user_id, lead_id: createdLead._id, id_project: id_project,
                      first_text: text, departmentid: departmentid, sourcePage: sourcePage,
                      language: language, userAgent: userAgent, status: status, createdBy: id_user,
                      attributes: attributes, subject: undefined, preflight: preflight, channel: undefined, location: undefined,
                      lead: createdLead, requester: puser
                    };
      
                    return requestService.create(new_request).then(function (savedRequest) {                   


                        if (attributes) {
                          attributes.sendnotification = false; //  sembra nn funzionae
                        }
                        
                        var senderFullname = fullname || 'Guest';

                        // create(sender, senderFullname, recipient, text, id_project, createdBy, status, attributes, type, metadata, language) {
                        return messageService.create( id_user, senderFullname , savedRequest.request_id, text,
                          id_project, id_user,  MessageConstants.CHAT_MESSAGE_STATUS.SENDING, attributes, type, eventTrigger.event.metadata, language);
                      }).catch(function (err) {
                        winston.error("Error trigger requestService.create", err);
                      });
                  });
            // });


    
      } catch(e) {
        winston.error("Error runAction", e);
      }

      });



    }

    delayedFunction(action,triggerEvent, waitTime) {
      setTimeout(function() {
        triggerEvent.action = action;
        // console.log("setTimeout",action.key, triggerEvent);
        triggerEventEmitter.emit(action.key,triggerEvent );
      }, waitTime);
    }

    createEngine() {

    }

    exec(event, eventKey,successCall,errorCall) {
      var that = this;
        // winston.verbose('this', this);

        // var eventKey = Object.keys(this._events);
        // var eventKey = Object.values(this._events);
        // winston.verbose('eventKey: ',eventKey);

        // winston.verbose('this', JSON.stringify(this));
        setImmediate(() => {

            
              winston.debug('event', event);
              winston.debug('successCall', successCall);
              winston.debug('trigger event', event);
            
            let query = {id_project: event.id_project, enabled:true, 'trigger.key':eventKey};
            

            winston.debug('trigger query', query);

            Trigger.find(query)
              .cache(cacheUtil.longTTL, event.id_project+":triggers:trigger.key:"+eventKey)
              .exec(function(err, triggers) {
                if (err) {
                    winston.error('Error gettting bots ', err);
                    return 0;
                }
                if (!triggers || triggers.length==0) {
                  winston.debug('No trigger found');
                  return 0;
                }

                winston.debug('active triggers found', triggers);


                // var engineExists = that.engines.hasOwnProperty(event.id_project);
                // // var engineExists = that.engines.hasOwnProperty(event.id_project+"-"+eventKey);
                // winston.verbose("engineExists:"+engineExists);

                // var engine;
                // if (!engineExists) {
                //   engine = new Engine();
                //   that.engines[event.id_project] = engine;
                //   // that.engines[event.id_project+"-"+eventKey] = engine;
                //   winston.verbose("create engine");
                // }else {
                //   engine = that.engines[event.id_project];
                //   // engine = that.engines[event.id_project+"-"+eventKey];
                //   winston.verbose("engine already exists");
                //   return 0;
                // }

                var engine = new Engine();     
                // winston.verbose("create engine");              
                // that.engine = new Engine();


                

                triggers.forEach(function(trigger) { 
                  winston.debug('trigger', trigger.toObject());

                  var rule = {
                    conditions: {
                    },
                    event: {  // define the event to fire when the conditions evaluate truthy
                      type: trigger.id,
                      // type: trigger.actions[0].key,
                      params: trigger.actions
                      // params: {id: trigger._id, actionParameters:trigger.actions[0].parameters}
                      // params: {
                      //   message: 'Player has fouled out!'
                      // }
                    }
                  };

                  // qui se non imposto condizioni  
                  // uncaughtException: "conditions" root must contain a single instance of "all" or "any"
                  // 2022-07-18T08:58:18.589888+00:00 app[web.1]: Error: "conditions" root must contain a single instance of "all" or "any"

                  if (trigger.conditions.all.toObject() && trigger.conditions.all.toObject().length>0) {
                    rule.conditions.all = trigger.conditions.all.toObject();
                  }

                  if (trigger.conditions.any.toObject() && trigger.conditions.any.toObject().length>0) {
                    rule.conditions.any = trigger.conditions.any.toObject();
                  }

                  
                  winston.debug('rule', rule);

                    // define a rule for detecting the player has exceeded foul limits.  Foul out any player who:
                // (has committed 5 fouls AND game is 40 minutes) OR (has committed 6 fouls AND game is 48 minutes)
                  
                  engine.addRule(rule);
                // that.engine.addRule(rule);

                });
                
                



                


              


                
                
                /**
                 * Define facts the engine will use to evaluate the conditions above.
                 * Facts may also be loaded asynchronously at runtime; see the advanced example below
                 */
                

                // let facts = event.toObject();
                let facts;
                if  (event.toJSON) {  //request is mongoose object
                    facts = event.toJSON();
                }else {                 //message is plain object because messageEvent replace it
                    facts = event;
                }
                winston.verbose("facts", facts);

                engine.addFact("json", facts)                                       



                engine.on('success', function(eventSuccess, almanac, ruleResult) {
                  // info: runAction eventTrigger.eventSuccess: {"type":"request.create","params":{"id":"5e4a771a248688f8ea55e47a","actionParameters":{"fullName":"fullName","text":"hi"}}}
                  winston.debug("success eventSuccess", eventSuccess); 
                  winston.debug("success ruleResult", ruleResult); 

                  var triggerEvent = {event: event, eventKey:eventKey , triggers: triggers, ruleResult:requestEvent,eventSuccess:eventSuccess, engine:engine };

                  // info: test success eventTrigger:{
                    // "event":{"_id":"5e4a771a248688f8ea55e47e","name":"user.pay","attributes":{"attr1":"val1"},"id_project":"5e4a771a248688f8ea55e476","project_user":{"_id":"5e4a771a248688f8ea55e477","id_project":"5e4a771a248688f8ea55e476","id_user":{"_id":"5e4a771a248688f8ea55e475","email":"test-trigger-EventEmit-1581938458317@email.com","firstname":"Test Firstname","lastname":"Test lastname","createdAt":"2020-02-17T11:20:58.326Z","updatedAt":"2020-02-17T11:20:58.326Z","__v":0},"role":"owner","user_available":true,"createdBy":"5e4a771a248688f8ea55e475","createdAt":"2020-02-17T11:20:58.580Z","updatedAt":"2020-02-17T11:20:58.580Z","__v":0,"id":"5e4a771a248688f8ea55e477"},"createdBy":"5e4a771a248688f8ea55e475","createdAt":"2020-02-17T11:20:58.603Z","updatedAt":"2020-02-17T11:20:58.603Z","__v":0},
                    // "eventKey":"event.emit",
                    // "triggers":[{"enabled":true,"_id":"5e4a771a248688f8ea55e47a","name":"test","description":"test desc","id_project":"5e4a771a248688f8ea55e476","trigger":{"_id":"5e4a771a248688f8ea55e47b","key":"event.emit","name":"event emit event","description":"event emit descr"},"conditions":{"_id":"5e4a771a248688f8ea55e47c","all":[{"key":"event1","fact":"json","path":"attributes.attr1","operator":"equal","value":"val1"}],"any":[]},"actions":[{"_id":"5e4a771a248688f8ea55e47d","key":"request.create","parameters":{"fullName":"fullName","text":"hi"}}],"createdBy":"5e4a771a248688f8ea55e475","createdAt":"2020-02-17T11:20:58.597Z","updatedAt":"2020-02-17T11:20:58.597Z","__v":0}],
                    // "ruleResult":{"_events":{"request.create":[null,null,null,null,null],"request.close":[null,null,null]},"_eventsCount":7}
                    // ,"eventSuccess":{"type":"request.create","params":{"id":"5e4a771a248688f8ea55e47a","actionParameters":{"fullName":"fullName","text":"hi"}}},
                    // "engine":{"_events":{},"_eventsCount":2,"rules":["{\"conditions\":{\"priority\":1,\"all\":[{\"operator\":\"equal\",\"value\":\"val1\",\"fact\":\"json\",\"path\":\"attributes.attr1\"}]},\"priority\":1,\"event\":{\"type\":\"request.create\",\"params\":{\"id\":\"5e4a771a248688f8ea55e47a\",\"actionParameters\":{\"fullName\":\"fullName\",\"text\":\"hi\"}}}}"],"allowUndefinedFacts":false,"operators":{},"facts":{},"status":"RUNNING","prioritizedRules":[["{\"conditions\":{\"priority\":1,\"all\":[{\"operator\":\"equal\",\"value\":\"val1\",\"fact\":\"json\",\"path\":\"attributes.attr1\"}]},\"priority\":1,\"event\":{\"type\":\"request.create\",\"params\":{\"id\":\"5e4a771a248688f8ea55e47a\",\"actionParameters\":{\"fullName\":\"fullName\",\"text\":\"hi\"}}}}"]]}}


                    // dopo
                    //  {"event":{"_id":"5e4a7e52f3f18136851535f5","name":"user.pay","attributes":{"attr1":"val1"},"id_project":"5e4a7e52f3f18136851535ed","project_user":{"_id":"5e4a7e52f3f18136851535ee","id_project":"5e4a7e52f3f18136851535ed","id_user":{"_id":"5e4a7e52f3f18136851535ec","email":"test-trigger-EventEmit-1581940306138@email.com","firstname":"Test Firstname","lastname":"Test lastname","createdAt":"2020-02-17T11:51:46.146Z","updatedAt":"2020-02-17T11:51:46.146Z","__v":0},"role":"owner","user_available":true,"createdBy":"5e4a7e52f3f18136851535ec","createdAt":"2020-02-17T11:51:46.397Z","updatedAt":"2020-02-17T11:51:46.397Z","__v":0,"id":"5e4a7e52f3f18136851535ee"},"createdBy":"5e4a7e52f3f18136851535ec","createdAt":"2020-02-17T11:51:46.422Z","updatedAt":"2020-02-17T11:51:46.422Z","__v":0},
                    // "eventKey":"event.emit",
                    // "triggers":[{"enabled":true,"_id":"5e4a7e52f3f18136851535f1","name":"test","description":"test desc","id_project":"5e4a7e52f3f18136851535ed","trigger":{"_id":"5e4a7e52f3f18136851535f2","key":"event.emit","name":"event emit event","description":"event emit descr"},"conditions":{"_id":"5e4a7e52f3f18136851535f3","all":[{"key":"event1","fact":"json","path":"attributes.attr1","operator":"equal","value":"val1"}],"any":[]},"actions":[{"_id":"5e4a7e52f3f18136851535f4","key":"request.create","parameters":{"fullName":"fullName","text":"hi"}}],"createdBy":"5e4a7e52f3f18136851535ec","createdAt":"2020-02-17T11:51:46.416Z","updatedAt":"2020-02-17T11:51:46.416Z","__v":0}],
                    // "ruleResult":{"_events":{"request.create":[null,null,null,null,null],"request.close":[null,null,null]},"_eventsCount":7},
                    // "eventSuccess":{"type":"5e4a7e52f3f18136851535f1","params":[{"_id":"5e4a7e52f3f18136851535f4","key":"request.create","parameters":{"fullName":"fullName","text":"hi"}}]},
                    // "engine":{"_events":{},"_eventsCount":2,"rules":["{\"conditions\":{\"priority\":1,\"all\":[{\"operator\":\"equal\",\"value\":\"val1\",\"fact\":\"json\",\"path\":\"attributes.attr1\"}]},\"priority\":1,\"event\":{\"type\":\"5e4a7e52f3f18136851535f1\",\"params\":[{\"_id\":\"5e4a7e52f3f18136851535f4\",\"key\":\"request.create\",\"parameters\":{\"fullName\":\"fullName\",\"text\":\"hi\"}}]}}"],"allowUndefinedFacts":false,"operators":{},"facts":{},"status":"RUNNING","prioritizedRules":[["{\"conditions\":{\"priority\":1,\"all\":[{\"operator\":\"equal\",\"value\":\"val1\",\"fact\":\"json\",\"path\":\"attributes.attr1\"}]},\"priority\":1,\"event\":{\"type\":\"5e4a7e52f3f18136851535f1\",\"params\":[{\"_id\":\"5e4a7e52f3f18136851535f4\",\"key\":\"request.create\",\"parameters\":{\"fullName\":\"fullName\",\"text\":\"hi\"}}]}}"]]}}
                  winston.debug("success triggerEvent", triggerEvent); 
                  
                  var pickedTrigger = triggers.filter( function (t) {
                    // winston.verbose("t:"+t._id);
                    // winston.verbose("eventSuccess.type:"+eventSuccess.type);
                    if (t.id === eventSuccess.type) {
                      // winston.verbose("uguale");
                      return true;
                    }
                  });
                  if (pickedTrigger && pickedTrigger.length>0) {
                    pickedTrigger = pickedTrigger[0];
                  }

                  winston.debug("pickedTrigger", pickedTrigger); 
                  triggerEvent.trigger = pickedTrigger;



                  // shiiiit https://stackoverflow.com/questions/37977602/settimeout-not-working-inside-foreach

                  // var a = [1,2,3]
                  // // var index = 0;   <- BUGGGGGGGG try it in the browser you must user index of the forEach
                  // a.forEach(function(e,index,c) {
                  //   // a.forEach(function(e) {
                  //   setTimeout(function() {
                  //     console.log(index, e);
                  //   },index * 1000);
                  //   // index++;
                  // });



                  // https://coderwall.com/p/_ppzrw/be-careful-with-settimeout-in-loops
                  pickedTrigger.actions.forEach(function (action, i, collection) {
                    winston.debug("triggerEventEmitter emit: " + action.key, action);
                    // triggerEvent.action = action;
                    var waitTime = 500*i;
                    // console.log("waitTime",waitTime);
                    // make timeout of 500 ms 
                    that.delayedFunction(action, triggerEvent, waitTime );
                    
                  });

                  // pickedTrigger.actions.forEach(function (action, i, collection) {
                  //   winston.verbose("triggerEventEmitter emit: " + action.key, action);
                  //   triggerEvent.action = action;
                  //   var waitTime = 500*i;
                  //   console.log("waitTime",waitTime);
                  //   // make timeout of 500 ms 
                  //   setTimeout(function() {
                  //     console.log("setTimeout",action.key, triggerEvent);
                  //     triggerEventEmitter.emit(action.key,triggerEvent );
                  //   }, waitTime);
                  //   // i++;
                  // });
                  

                  // successCall(eventSuccess.type,triggerEvent);
                });

                

                engine.on('failure', function(eventFailure, almanac, ruleResult) {
                  winston.debug("failure eventFailure", eventFailure); 

                  var triggerEvent = {event: event, eventKey:eventKey , triggers: triggers, ruleResult:requestEvent,engine:engine };
                  winston.debug("failure triggerEvent", triggerEvent); 


                  var pickedTrigger = triggers.filter( function (t) {
                    // winston.verbose("t:"+t._id);
                    // winston.verbose("eventFailure.type:"+eventFailure.type);
                    if (t.id === eventFailure.type) {
                      // winston.verbose("uguale");
                      return true;
                    }
                  });
                  if (pickedTrigger && pickedTrigger.length>0) {
                    pickedTrigger = pickedTrigger[0];
                  }

                  winston.debug("pickedTrigger", pickedTrigger); 
                  triggerEvent.trigger = pickedTrigger;
                  pickedTrigger.actions.forEach(function (action) {
                    winston.debug("triggerEventEmitter emit: " + action.key);
                    triggerEvent.action = action;
                    triggerEventEmitter.emit(action.key+".failure",triggerEvent );
                  });

                  // triggerEventEmitter.emit(eventFailure.type+".failure", triggerEvent);
                  // errorCall(eventSuccess.type,triggerEvent);
                });





                // Run the engine to evaluate
                engine
                  // .run(facts)
                  .run()
                  .then(events => { // run() returns events with truthy conditions
                    winston.verbose('all rules executed; the following events were triggered: ', events);
                    engine.stop();
                    // events.map(event => winston.debug(event.params.message));
                  })
                  // .catch () per beccare  uncaughtException: "conditions" root must contain a single instance of "all" or "any"
                              


            });        

        });
    }

}

var rulesTrigger = new RulesTrigger();
module.exports = rulesTrigger;

