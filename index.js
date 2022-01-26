//const Odoo = require('react-odoo');
const express = require("express");
var fs = require("fs");
const config = require("./key");
const bodyParser = require("body-parser");
const pino = require("express-pino-logger")();
// const Pool = require("pg").Pool;
const cors = require("cors");
const nodemailer = require('nodemailer');
var Odoo = require("odoo-xmlrpc");
var session = require("express-session");
var _ = require("underscore");
const moment = require("moment");
const formidable = require("formidable");
const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(pino);
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb'}));
let transport = nodemailer.createTransport(config.transportOptions);

var AWS = require('aws-sdk');
AWS.config.update(config.aws_config);
const s3 = new AWS.S3();
var illegalRe = /[\/\?<>\\:\*\|":]/g;
var controlRe = /[\x00-\x1f\x80-\x9f]/g;
var reservedRe = /^\.+$/;
var windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
function sanitize(input, replacement) {
  var sanitized = input
    .replace(illegalRe, replacement)
    .replace(controlRe, replacement)
    .replace(reservedRe, replacement)
    .replace(windowsReservedRe, replacement);
  return sanitized.split("").splice(0, 255).join("");
}

const { Pool ,Client } = require('node-postgres');
c

const pool = new Pool(config.pool_conn);
var odoo = new Odoo(config.odoo_conn);

app.get("/api/getTrainings", async function (req, res) {
  console.log("getTrainings:::");

  // await client.connect();

  const result = await pool.query("SELECT * from training_courses");
  console.log("training courses:::", result);
  // res.send(result)
  res.send(result);
});

app.post("/loginWithOTP", async (req, res) => {
  console.log("saveEmployee req.body:::::", req.body.params);

  // app.post('/loginWithOTP', async (req, res) => {
  //     console.log("loginWithOTP req.body:::::", req.body.params);
  let reqData = req.body.params;
  console.log("loginWithOTP", reqData);

  try {
    // make sure that any items are correctly URL encoded in the connection string

    let queryStr =
      "SELECT id, company, first_name, last_name, dob, email FROM hospital_employee WHERE upper(email) = upper('" +
      reqData.email.trim() +
      "') ";
    console.log("queryStr", queryStr);

    const result = await pool.query(queryStr);
    // const result = pool.query(queryStr)

    // console.log("result :: ", result);

    if (result && result.rows && result.rows.length > 0) {
      console.log("result******* :: ", result.rows[0]);
      let otp = require("crypto").randomInt(0, 1000000);
      // let otp=1234
      console.log("otp ::: ", otp);

      let userOTPQueryStr =
        "SELECT * FROM hospital_employee_otp WHERE upper(email) = upper('" +
        reqData.email.trim() +
        "')";
      const userOTPResult = await pool.query(userOTPQueryStr);
      console.log(`login userOTPResult`, userOTPResult);
      console.log(
        "momentin :::::::",
        moment(result.rows[0].dob).format("MM-DD-YYYY").toString()
      );

      if (userOTPResult.rows && userOTPResult.rows.length > 0) {
        const updateResult = await pool.query(
          `UPDATE hospital_employee_otp SET otp = ${otp},dob='${moment(
            result.rows[0].dob
          ).format("MM-DD-YYYY")}' WHERE upper(email) = upper('${
            reqData.email
          }')`
        );
        console.log(`login updateResult`, updateResult);
      } else {
        let id = result.rows[0].id;
        let name = result.rows[0].first_name + " " + result.rows[0].last_name;
        let insertResult = await pool.query(
          `insert into hospital_employee_otp (employee_id, employee_name, email, otp, dob, "loginDate") values (${id}, '${name}', '${
            reqData.email
          }', '${otp}', '${moment(result.rows[0].dob).format(
            "MM-DD-YYYY"
          )}', '${moment.utc().format("YYYY-MM-DD")}')`
        );
        console.log(`login insertResult`, insertResult);
      }

      const otpMessage = {
        from: '"WSS <' + config.emailSender + '>"', // Sender address
        to: reqData.email, // List of recipients
        // bcc: config.bccRecipient,
        subject: "OTP for secure login on COVID Reporting Portal", // Subject line
        html:
          '<html><head><title>OTP</title><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/css/bootstrap.min.css"><script src="https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js"></script><script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/js/bootstrap.min.js"></script></head><body style="padding:30px;">' +
          "<p>Dear Valued Customer,</p><br/><br/>" +
          "<p>Your Password for Secure Login is: " +
          otp +
          "<br /><br/>" +
          "For more detail please contact to the admin at  info@WorkplaceSafetyScreenings.com.</p>" +
          '</div></div><br/><br/><div class="row" style="background-color:#dbdada"><div class="col-sm-4"></div> <div class="col-sm-4" style="font-size:16px;padding:10px;">' +
          '<b>Thank you.<br/><br/></b></div><div class="col-sm-4"></div></div></div></body></html>',
      };

      let respCompanyEmailResp = await wrapedSendMail(otpMessage);
      console.log("respCompanyEmailResp", respCompanyEmailResp);

      res.send(result.rows[0]);
    } else {
      res.send({ error: "user not found" });
    }
  } catch (err) {
    // ... error checks
    console.log(err);
    res.send(err);
  }
});

app.post("/api/getPolicyData", async function (req, res) {

  console.log("getPolicyData:::")
  
  // await client.connect();

  const result = await pool.query('SELECT * from policies');
  console.log("getPolicyData:::",result);
  // res.send(result)
  res.send(result)
  

});

app.post("/api/getCompLogo", async function (req, res) {

  console.log("getCompLogo:::",req.body.params)
  
  // await client.connect();
  // ${Number(req.query.employee_id)}
  const result = await pool.query(`SELECT * from ir_attachment where res_id='${req.body.params.custId}'`)
  console.log("getCompLogo data::",result);
  // res.send(result)
  res.send(result)
  

});


  app.post("/api/getTrainings", async function (req, res) {

    console.log("getTrainings:::")
    
    // await client.connect();
 
    const result = await pool.query('SELECT * from training_courses');
    console.log("training courses:::",result);
    // res.send(result)
    res.send(result)
    

});

app.post("/api/getCourseEmp", async function (req, res) {

  console.log("getCourseEmp:::");
  
  // await client.connect();

  const result = await pool.query('SELECT * FROM training_courses_employee');
  console.log("training_courses_employee:::",result);
  // res.send(result)
  res.send(result)
  

});

app.post("/api/saveCourseEmp", async function (req, res) {

  console.log("saveCourseEmp:::",req.body.params)

  let status ="pending"
  let dateNow = new Date();
  //id=1;
  
  // await client.connect();
  console.log(`INSERT INTO training_courses_employee
  (employee_id,employee_name,course_id,course_name,training_start_date,training_end_date,status)
   VALUES(${Number(req.body.params.employee_id)},'${req.body.params.employee_name}',
   ${Number(req.body.params.course_id)}, '${req.body.params.course_name}','${req.body.params.start_date}',
   '${req.body.params.completion_date}','${status}','${moment(dateNow).format('YYYY-MM-DD')}')`)

  const result = await pool.query(`INSERT INTO training_courses_employee
  (employee_id,employee_name,course_id,course_name,training_start_date,training_end_date,status,"createdOn")
   VALUES(${Number(req.body.params.employee_id)},'${req.body.params.employee_name}',
   ${Number(req.body.params.course_id)}, '${req.body.params.course_name}','${req.body.params.start_date}',
   '${req.body.params.completion_date}','${status}','${moment(dateNow).format('YYYY-MM-DD')}')`)
  console.log("Add course");
  // res.send(result)
  res.send("insert succesfully!!")
  

});
  
//const Odoo = require('odoo-api');

// const odoo = new Odoo({
//     host: '192.168.2.61',
//     port: 5433
// });

// odoo
//     .connect({
//         database: 'tmdatabase',
//         username: 'tm',
//         password: '8755947425'
//     })
//     .then(client => {
//         console.log('client',client);
//         return client.searchRead('product.product', [['list_price', '>', '50']], {limit: 1});
//     })
//     .then(products => {
//         console.log('products',products);
//         //=> [{list_price: 52, name: 'Unicorn'}]
//     });

// app.use(session({ secret: 'keyboard cat',resave: false,saveUninitialized: true, cookie: { maxAge: 60000 }}));

// app.get('/', function(req, res, next) {
//   if (req.session.views) {
//     req.session.views++
//     res.setHeader('Content-Type', 'text/html')
//     res.write('<p>views: ' + req.session.views + '</p>')
//     res.write('<p>expires in: ' + (req.session.cookie.maxAge / 1000) + 's</p>')
//     res.end()
//   } else {
//     req.session.views = 1
//     res.end('welcome to the session demo. refresh!')
//   }
// })

app.post("/api/users", (req, res) => {
  console.log("req--users", req.body.params);
  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.body.params.user;
  l_odoo_conn.password = req.body.params.pass;
  var odoo = new Odoo(l_odoo_conn);

  odoo.connect(function (err) {
    if (err) {
      res.send("File not found");
      return console.log("error", err);
    }

    console.log("Connected to Odoo server new users");

    // res.send();
        var inParams = [];
        
        inParams.push([
          ["email", "=", req.body.params.user],
          ["customer_portal", "=", true]
        ]);
        var params = [];
        params.push(inParams);
        odoo.execute_kw('res.users', 'search', params, function (err, value) {
            if (err) { 
              // console.log(err)
              // res.send({error: "Technical Error"})
              // return;
             }
            console.log("res ///",value)
            if(value && value.length>0)
            {
                var inParams = [];
                inParams.push(value); //ids

                var params = [];
                params.push(inParams);
                odoo.execute_kw('res.users', 'read', params, async function (err2, value2) {
                    if (err2) { res.send({error: err2}) }
                    // console.log('Result values:::: ', value2);
                              
                    let otp = require("crypto").randomInt(0, 1000000);										
                    // let otp=1234											
                    console.log("otp ::: ", otp);										
                                
                    let userOTPQueryStr = "SELECT * FROM res_users_otp WHERE upper(email) = upper('" + req.body.params.user.trim()+"')";											
                    const userOTPResult = await pool.query(userOTPQueryStr)											
                    // console.log(`login userOTPResult`	,userOTPResult);										
                                      
                                
                    if(userOTPResult.rows && userOTPResult.rows.length>0){											
                        const updateResult = await pool.query(`UPDATE res_users_otp SET otp = ${otp} WHERE upper(email) = upper('${req.body.params.user}')`)										
                        // console.log(`login updateResult`, updateResult)										
                    }else{											
                        let insertResult = await pool.query(`insert into res_users_otp (email, otp, "loginDate") values ('${req.body.params.user}','${otp}','${moment.utc().format("YYYY-MM-DD")}')`)	
                        // console.log(`login insertResult`, insertResult)										
                    }											
                                
                    const otpMessage = {											
                        from: '"WSS <' + config.emailSender + '>"',   // Sender address										
                        to: req.body.params.user,        // List of recipients										
                        // bcc: config.bccRecipient											
                        subject: 'OTP for secure login on COVID Reporting Portal',	 // Subject line										
                        html: '<html><head><title>OTP</title><meta charset="utf-8"><meta name="viewport" content="width=device-width	 initial-scale=1"><link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/css/bootstrap.min.css"><script src="https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js"></script><script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/js/bootstrap.min.js"></script></head><body style="padding:30px;">'										
                        +'<p>Dear Valued Customer	</p><br/><br/>'										
                        +'<p>Your Password for Secure Login is: '+otp+'<br /><br/>'											
                        +'For more detail please contact to the admin at  info@WorkplaceSafetyScreenings.com.</p>'											
                        +'</div></div><br/><br/><div class="row" style="background-color:#dbdada"><div class="col-sm-4"></div> <div class="col-sm-4" style="font-size:16px;padding:10px;">'											
                        +'<b>Thank you.<br/><br/></b></div><div class="col-sm-4"></div></div></div></body></html>'											
                    };											
                                
                    let respCompanyEmailResp =  await wrapedSendMail(otpMessage);											
                    // console.log('respCompanyEmailResp',respCompanyEmailResp);										
                                
                                
                    res.send('Done');	

                      
                });
            }
            else
            {
              res.send({error: 'Access Denied'})
            }
        });
    });
});
										
                    
                    
// app.post('/VerifyOTP'	 (req	 res) => {									
app.post("/api/VerifyOTP",async (req, res) => {									
  console.log("saveEmployee req.body:::::", req.body.params);										
  let reqData = req.body.params;											
  console.log('VerifyOTP',reqData);	
  
  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.body.params.user;
  l_odoo_conn.password = req.body.params.pass;
  var odoo = new Odoo(l_odoo_conn);
                    
  odoo.connect(function (err, email) {										
    if (err) {											
      //  console.log("first error", err);	
      console.log(err)
         res.send({error: err})
         return;									
    }											
  //   console.log("Connected to Odoo server Cust EmployeeInfo"	 req.query.user);										
    var inParams = [];											
    email_lower = reqData.user.toLowerCase().trim();											
    inParams.push([											
      ["email","=",email_lower]									
    ]);											
    console.log("myemail is",	email_lower);										
    inParams.push([]);											
    // inParams.push(0);  //offset											
    // inParams.push(1);  //Limit											
    var params = [];											
    params.push(inParams);											
                    
                    
    odoo.execute_kw("res.users","search", params,	function (err,value) {							
      if (err) {											
         console.log("Error detected",err);	
         res.send({error: err})
         return;									
      }											
      console.log("res", value);										
      var inParams = [];											
      inParams.push(value); //ids											
      var params = [];											
      params.push(inParams);											
      odoo.execute_kw("res.users", "read", params, async function (err2, value2) {							
        if (err2) {											
          console.log(err2);	
          res.send({error: err})
          return;										
        }											
        										
          if(value2 && value2.length>0){											
                    
              let otpQueryStr = "SELECT * FROM res_users_otp WHERE upper(email) = upper('" + reqData.user.trim()+"') and trim(otp)='"+reqData.otp.trim()+"'";											
              console.log('otpQueryStr',otpQueryStr);										
                    
              const otpResult = await pool.query(otpQueryStr)											
                    
              if(otpResult.rows && otpResult.rows.length>0)											
              {											
                console.log("res_user_otp:::::::",otpResult.rows)										
                  res.send(value2[0]);											
              }											
              else{											
                  res.send({error:"OTP does not match."});											
              }											          
          }
          else{											
              res.send({error:"user not found"});											
          }											
      });											
    });											
  });											                  
});											
                    
	
		

app.get("/api/userData", (req, res) => {
  console.log("req--userData", req.query);
  //console.log("req.session",req.session);

  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.query.user;
  l_odoo_conn.password = req.query.pass;
  var odoo = new Odoo(l_odoo_conn);

  odoo.connect(function (err, uid) {
    if (err) {
      // return console.log(err);
      console.log(err)
         res.send({error: err})
         return;
    }
    console.log("Connected to Odoo server Employee");
    var inParams = [];
    inParams.push([]);
    //inParams.push(0);  //offset
    //inParams.push(6);  //Limit
    var params = [];
    params.push(inParams);
    odoo.execute_kw("res.users", "search_read", params, function (err, value) {
      if (err) {
        // return console.log(err);
         console.log(err)
         res.send({error: err})
         return;
      }
      res.send(value)
      //console.log("res",value)
      // var inParams = [];
      // inParams.push(value); //ids

      // var params = [];
      // params.push(inParams);
      // odoo.execute_kw("res.users", "read", params, function (err2, value2) {
      //   if (err2) {
      //     return console.log(err2);
      //   }
      //   // console.log("Result: ", value2);
      //   res.send(value2);
      // });
    });
  });
});

app.get("/api/data", (req, res) => {
  console.log("req--data", req.query);
  //console.log("req.session",req.session);

  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.query.user;
  l_odoo_conn.password = req.query.pass;
  var odoo = new Odoo(l_odoo_conn);

  odoo.connect(function (err, uid) {
    if (err) {
      // return console.log(err);
      console.log(err)
         res.send({error: err})
         return;
    }
    console.log("Connected to Odoo server Employee");
    var inParams = [];
    inParams.push([]);
    //inParams.push(0);  //offset
    //inParams.push(6);  //Limit
    var params = [];
    params.push(inParams);
    odoo.execute_kw(
      "hospital.patientsinfo",
      "search_read",
      params,
      function (err, value) {
        if (err) {
          // return console.log(err);
          console.log(err)
         res.send({error: err})
         return;
        }
        res.send(value)
        //console.log("res",value)
        // var inParams = [];
        // inParams.push(value); //ids

        // var params = [];
        // params.push(inParams);
        // odoo.execute_kw(
        //   "hospital.patientsinfo",
        //   "read",
        //   params,
        //   function (err2, value2) {
        //     if (err2) {
        //       return console.log(err2);
        //     }
        //     // console.log("Result: ", value2);
        //     res.send(value2);
        //   }
        // );
      }
    );
  });
});

app.post("/api/employeeCust", (req, res) => {
  console.log("employeeCust:::")
  // console.log("req--employeeCust:::::", req.body.params.custIdArr);
  console.log("req--employeeCust:::::", req.body);
  //console.log("req.session",req.session);
// console.log("req.query employee list::",JSON.parse(req.query[0]).employee_multi_select)
  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.body.params.user;
  l_odoo_conn.password = req.body.params.pass;
  var odoo = new Odoo(l_odoo_conn);

  odoo.connect(function (err, uid) {
    if (err) {
      // return console.log(err);
         console.log(err)
         res.send({error: err})
         return;
    }
    console.log("Connected to Odoo server employeeCust::");
    var inParams = [];
    // inParams.push([]);

    inParams.push([
      ["id", "in", req.body.params.custIdArr]
    ]
    );
    inParams.push(['Gender', 'company', 'country_id','create_date','display_name','dob',
    'email','emp_location','emp_ssn','emp_status','last_name','first_name','program','reasons',
    'report_date','requestFrom','state_id','middle_name','mode','nationality','street','street2',
    'telephone','users','zip','__last_update','Mobile', 'covid_tests', 'covid_vaccination','emp_account_number',
    'intake_forms','requested','Job_Title']);

    //inParams.push(0);  //offset
    //inParams.push(6);  //Limit
    var params = [];
    params.push(inParams);
    odoo.execute_kw(
      "hospital.employee",
      "search_read",
      params,

      function (err, value) {
        if (err) {
          // return console.log("err:::",err);
         console.log(err)
         res.send({error: err})
         return;
        }
            res.send(value);
          }
        );
      }
    );
  });
// });

app.post("/api/employee", (req, res) => {
  console.log("req--employee", req.body.params);
  //console.log("req.session",req.session);

  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.body.params.user;
  l_odoo_conn.password = req.body.params.pass;
  var odoo = new Odoo(l_odoo_conn);

  odoo.connect(function (err, uid) {
    if (err) {
      // return console.log(err);
      console.log(err)
         res.send({error: err})
         return;
    }
    console.log("Connected to Odoo server Employee");
    var inParams = [];
    inParams.push([]);
    //inParams.push(0);  //offset
    //inParams.push(6);  //Limit
    var params = [];
    params.push(inParams);
    odoo.execute_kw(
      "hospital.employee",
      "search_read",
      params,
      function (err, value) {
        if (err) {
          // return console.log(err);
          console.log(err)
         res.send({error: err})
         return;
        }
        res.send(value)
        //console.log("res",value)
        // var inParams = [];
        // inParams.push(value); //ids

        // var params = [];
        // params.push(inParams);
        // odoo.execute_kw(
        //   "hospital.employee",
        //   "read",
        //   params,
        //   function (err2, value2) {
        //     if (err2) {
        //       return console.log(err2);
        //     }
        //     // console.log("Result: ", value2);
        //     res.send(value2);
        //   }
        // );
      }
    );
  });
});

app.post("/api/employeeTest", (req, res) => {
  console.log("req--employeeTest", req.body.params);
  //console.log("req.session",req.session);

  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.body.params.user;
  l_odoo_conn.password = req.body.params.pass;
  var odoo = new Odoo(l_odoo_conn);

  odoo.connect(function (err, uid) {
    if (err) {
      // return console.log(err);
      console.log(err)
              res.send({error: err})
              return;
    }
    console.log("Connected to Odoo server Employee");
    var inParams = [];
    inParams.push([]);
    //inParams.push(0);  //offset
    //inParams.push(6);  //Limit
    var params = [];
    params.push(inParams);
    odoo.execute_kw(
      "appointment.register.tests",
      "search_read",
      params,
      function (err, value) {
        if (err) {
          // return console.log(err);
          console.log(err)
         res.send({error: err})
         return;
        }
        res.send(value)
        //console.log("res",value)
        // var inParams = [];
        // inParams.push(value); //ids

        // var params = [];
        // params.push(inParams);
        // odoo.execute_kw(
        //   "appointment.register.tests",
        //   "read",
        //   params,
        //   function (err2, value2) {
        //     if (err2) {
        //       return console.log(err2);
        //     }
        //     //console.log('Result: ', value2);
        //     res.send(value2);
        //   }
        // );
      }
    );
  });
});

app.post("/api/getTestDetails", (req, res) => {
  console.log("req--getTestDetails", req.body.params);
  //console.log("req.session",req.session);

  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.body.params.user;
  l_odoo_conn.password = req.body.params.pass;
  var odoo = new Odoo(l_odoo_conn);

  odoo.connect(function (err, uid) {
    if (err) {
      // return console.log(err);
      console.log(err)
              res.send({error: err})
              return;
    }
    console.log("Connected to Odoo server test");
    var inParams = [];
    inParams.push([
      ["company", "=", Number(req.body.params.customerId)]
    ]);
    //inParams.push(0);  //offset
    //inParams.push(6);  //Limit
    var params = [];
    params.push(inParams);
    odoo.execute_kw(
      "appointment.register.tests",
      "search_read",
      params,
      function (err, value) {
        if (err) {
          // return console.log(err);
          console.log(err)
         res.send({error: err})
         return;
        }
        res.send(value);
        //console.log("res",value)
        // var inParams = [];
        // inParams.push(value); //ids

        // var params = [];
        // params.push(inParams);
        // odoo.execute_kw(
        //   "appointment.register.tests",
        //   "read",
        //   params,
        //   function (err2, value2) {
        //     if (err2) {
        //       return console.log(err2);
        //     }
        //     //console.log('Result: ', value2);
        //     res.send(value2);
        //   }
        // );
      }
    );
  });
});

app.post("/api/getTestRegister", (req, res) => {
  console.log("req--getTestRegister", req.body.params);
  //console.log("req.session",req.session);

  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.body.params.user;
  l_odoo_conn.password = req.body.params.pass;
  var odoo = new Odoo(l_odoo_conn);

  odoo.connect(function (err, uid) {
    if (err) {
      // return console.log(err);
      console.log(err)
      res.send({error: err})
      return;
    }
    console.log("Connected to Odoo server getTestRegister");
    var inParams = [];
    inParams.push([]);
    //inParams.push(0);  //offset
    //inParams.push(6);  //Limit
    var params = [];
    params.push(inParams);
    odoo.execute_kw("test.register", "search_read", params, function (err, value) {
      if (err) {
        // return console.log(err);
        console.log(err)
         res.send({error: err})
         return;
      }
      res.send(value)
      //console.log("res",value)
      // var inParams = [];
      // inParams.push(value); //ids

      // var params = [];
      // params.push(inParams);
      // odoo.execute_kw("test.register", "read", params, function (err2, value2) {
      //   if (err2) {
      //     return console.log(err2);
      //   }
      //   //console.log('Result: ', value2);
      //   res.send(value2);
      // });
    });
  });
});

app.post("/api/Res", (req, res) => {
  console.log("req--Res", req.body.params);
  //console.log("req.session",req.session);

  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.body.params.user;
  l_odoo_conn.password = req.body.params.pass;
  var odoo = new Odoo(l_odoo_conn);

  odoo.connect(function (err, uid) {
    if (err) {
      // return console.log(err);
      console.log(err)
      res.send({error: err})
      return;
    }
    console.log("Connected to Odoo server Cust Loc", req.body.params.user);
    var inParams = [];
    inParams.push([
      ["commercial_partner_id", "=", Number(req.body.params.id)],
      ["type", "=", "other"],
      ["is_company", "=", false],
    ]);
    // inParams.push([]);
    // inParams.push(0);  //offset
    // inParams.push(1);  //Limit
    var params = [];
    params.push(inParams);
    odoo.execute_kw("res.partner", "search_read", params, function (err, value) {
      if (err) {
        // return console.log(err);
        console.log(err)
         res.send({error: err})
         return;
      }
      res.send(value)
      // console.log("res", value);
      // var inParams = [];
      // inParams.push(value); //ids
      // var params = [];
      // params.push(inParams);
      // odoo.execute_kw("res.partner", "read", params, function (err2, value2) {
      //   if (err2) {
      //     return console.log(err2);
      //   }
      //   //console.log('Cust Loc: ', value2);
      //   res.send(value2);
      // });
    });
  });
});

app.post("/api/CustomerData", (req, res) => {
  console.log("req--CustomerData", req.body.params);
  //console.log("req.session",req.session);

  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.body.params.user;
  l_odoo_conn.password = req.body.params.pass;
  var odoo = new Odoo(l_odoo_conn);

  odoo.connect(function (err, uid) {
    if (err) {
      // return console.log(err);
      console.log(err)
      res.send({error: err})
      return;
    }
    console.log("Connected to Odoo server Cust Loc", req.body.params.user);
    var inParams = [];
    // inParams.push([['email', '=', req.query.user],['is_company', '=', true]]);
    inParams.push([["login", "in", uid]]);
    // inParams.push(0);  //offset
    // inParams.push(1);  //Limit
    var params = [];
    params.push(inParams);
    odoo.execute_kw("res.partner", "search_read", params, function (err, value) {
      if (err) {
        // return console.log(err);
        console.log(err)
         res.send({error: err})
         return;
      }
      res.send(value)
      // console.log("res", value);
      // var inParams = [];
      // inParams.push(value); //ids
      // var params = [];
      // params.push(inParams);
      // odoo.execute_kw("res.partner", "read", params, function (err2, value2) {
      //   if (err2) {
      //     return console.log(err2);
      //   }
      //   //console.log('Cust Loc: ', value2);
      //   res.send(value2);
      // });
    });
  });
});
app.post("/api/saveLocation", (req, res) => {
  console.log("saveLocation req.body:::::", req.body.params);
  // console.log("saveEmployee req.query:::::", req.query);

  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.body.params.user;
  l_odoo_conn.password = req.body.params.pass;
  var odoo = new Odoo(l_odoo_conn);

  odoo.connect(async (err)=> {
    if (err) {
      // return console.log(err);
      console.log(err)
      res.send({error: err})
      return;
    }
    console.log("Connected to Odoo server.");
    var inParams = [];
    inParams.push({
      name: req.body.params.name,
      street: req.body.params.streetNew,
      street2: req.body.params.street2New,
      zip: req.body.params.zipNew,
      city: req.body.params.cityNewA,
      state_id: req.body.params.stateNewA[0] ? Number(req.body.params.stateNewA[0]):0,
      country_id: req.body.params.countrNew[0] ? Number(req.body.params.countrNew[0]):0,
      // emp_ssn: req.body.params.ssnNew,
      // emp_status: req.body.params.statusNew.toLowerCase(),
      // dob: req.body.params.dateNew,
      // Gender: req.body.params.sexNew,
      // company: Number(req.body.params.comNew),
    //   age: Number(req.body.params.age),
      // age:req.body.params.dateNew,
      // requestFrom : 'WEB',
      // type=req.body.params.other,
      parent_id: req.body.params.comp_id,
      type:'other'
    });

    var params = [];
    params.push(inParams);

    console.log("inParams",inParams)

    await odoo.execute_kw(
      "res.partner",
      "create",
      params,
      function (err, value) {
        if (err) {
          // return console.log(err);
          console.log(err)
         res.send({error: err})
         return;
        }
        //console.log('Result: ', value);
        res.send("Created Employee!!");
      }
    );

    // const newMessage = {
    //     from: config.emailSender, // Sender address
    //     to: req.query.emailNew, // List of recipients
    //     // bcc: config.bccRecipient,
    //     subject: "New Employee Added", // Subject line
    //     html: '<html><head><title>Link for Physical Intake Form </title><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/css/bootstrap.min.css"><script src="https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js"></script><script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/js/bootstrap.min.js"></script></head><body style="padding:30px;">'
    //         // + req.body.message[0].message_body.replace('"<',"<").replace(/\\n\"/g, '').replace(/\n/g, '')
    //         + 'Dear ' +req.query.firstNameNew +',</p>'
    //         + '<br />'
    //         + 'A new employee has been added in your company.</p>'
    //         + 'Please click on below link to fill intake form:-</p>'
    //         + '<br />'
    //         + '<a href="'+config.customer_portal_link+'/#/public/intakeform/'+ req.query.emailNew +'">Link</a>'
    //         + '<br /><br/>'
    //         + 'For any queries or clarification, please contact info@WorkplaceSafetyScreenings.com</p>'
    //         + '</div></div><br/><br/><div class="row" style="background-color:#dbdada"><div class="col-sm-4"></div> <div class="col-sm-4" style="font-size:16px;padding:10px;">'
    //         + '<b>Thank you<br/>WSS Team<br/></b></div><div class="col-sm-4"></div></div></div></body></html>'
    // };
    //
    // await wrapedSendMail(newMessage);


  });
});
app.post("/api/CustomerDataApp", (req, res) => {
  console.log("req--CustomerData", req.body.params);
  //console.log("req.session",req.session);

  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.body.params.user;
  l_odoo_conn.password = req.body.params.pass;
  var odoo = new Odoo(l_odoo_conn);

  odoo.connect(function (err, uid) {
    if (err) {
      // return console.log(err);
      console.log(err)
      res.send({error: err})
      return;
    }
    console.log("Connected to Odoo server Cust Loc", req.query.user);
    var inParams = [];
    // inParams.push([['email', '=', req.query.user],['is_company', '=', true]]);
    inParams.push([["login", "in", uid],['is_company', '=', true]]);
    // inParams.push(0);  //offset
    // inParams.push(1);  //Limit
    var params = [];
    params.push(inParams);
    odoo.execute_kw("res.partner", "search_read", params, function (err, value) {
      if (err) {
        // return console.log(err);
        console.log(err)
         res.send({error: err})
         return;
      }
      res.send(value)
      // console.log("res", value);
      // var inParams = [];
      // inParams.push(value); //ids
      // var params = [];
      // params.push(inParams);
      // odoo.execute_kw("res.partner", "read", params, function (err2, value2) {
      //   if (err2) {
      //     return console.log(err2);
      //   }
      //   //console.log('Cust Loc: ', value2);
      //   res.send(value2);
      // });
    });
  });
});

app.post("/api/allCustomerData", (req, res) => {
  console.log("req--CustomerData", req.body.params);
  //console.log("req.session",req.session);

  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.body.params.user;
  l_odoo_conn.password = req.body.params.pass;
  var odoo = new Odoo(l_odoo_conn);

  odoo.connect(function (err, uid) {
    if (err) {
      // return console.log(err);
      console.log(err)
      res.send({error: err})
      return;
    }
    console.log("Connected to Odoo server Cust Loc", req.body.params.user);
    var inParams = [];
    inParams.push([]);
    // inParams.push(0);  //offset
    // inParams.push(1);  //Limit
    var params = [];
    params.push(inParams);
    odoo.execute_kw("res.partner", "search_read", params, function (err, value) {
      if (err) {
        // return console.log(err);
        console.log(err)
         res.send({error: err})
         return;
      }
      res.send(value)
      // console.log("res", value);
      // var inParams = [];
      // inParams.push(value); //ids
      // var params = [];
      // params.push(inParams);
      // odoo.execute_kw("res.partner", "read", params, function (err2, value2) {
      //   if (err2) {
      //     return console.log(err2);
      //   }
      //   //console.log('Cust Loc: ', value2);
      //   res.send(value2);
      // });
    });
  });
});


app.post("/api/getCustomerLocation", (req, res) => {
  console.log("req--getCustomerLocation", req.body.params);
  //console.log("req.session",req.session);

  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.body.params.user;
  l_odoo_conn.password = req.body.params.pass;
  var odoo = new Odoo(l_odoo_conn);

  odoo.connect(function (err, uid) {
    if (err) {
      // return console.log(err);
      console.log(err)
      res.send({error: err})
      return;
    }
    console.log("Connected to Odoo server getCustomerLocation", req.body.params.user);
    var inParams = [];
    inParams.push([["commercial_partner_id", "=", Number(req.body.params.companyId)], ['is_company', '=', false], ['type', '=', 'other']]);
    var params = [];
    params.push(inParams);
    odoo.execute_kw("res.partner", "search_read", params, function (err, value) {
      if (err) {
        // return console.log(err);
        console.log(err)
         res.send({error: err})
         return;
      }
      res.send(value)
      // console.log("res", value);
      // var inParams = [];
      // inParams.push(value); //ids
      // var params = [];
      // params.push(inParams);
      // odoo.execute_kw("res.partner", "read", params, function (err2, value2) {
      //   if (err2) {
      //     return console.log(err2);
      //   }
      //   //console.log('Cust Loc: ', value2);
      //   res.send(value2);
      // });
    });
  });
});

app.get("/api/allCustomerDatId", (req, res) => {
  console.log("req--allCustomerDatId", req.query);
  //console.log("req.session",req.session);

  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.query.user;
  l_odoo_conn.password = req.query.pass;
  var odoo = new Odoo(l_odoo_conn);

  odoo.connect(function (err, uid) {
    if (err) {
      // return console.log(err);
      console.log(err)
      res.send({error: err})
      return;
    }
    console.log("Connected to Res", req.query.event);
    var inParams = [];
    inParams.push(["id", "=", Number(req.query.event)]);
    // inParams.push(0);  //offset
    // inParams.push(1);  //Limit
    var params = [];
    params.push(inParams);
    odoo.execute_kw("res.partner", "search_read", params, function (err, value) {
      if (err) {
        // return console.log(err);
        console.log(err)
         res.send({error: err})
         return;
      }
      res.send(value)
      // console.log("res", value);
      // var inParams = [];
      // inParams.push(value); //ids
      // var params = [];
      // params.push(inParams);
      // odoo.execute_kw("res.partner", "read", params, function (err2, value2) {
      //   if (err2) {
      //     return console.log(err2);
      //   }
      //   //console.log('Cust Loc: ', value2);
      //   res.send(value2);
      // });
    });
  });
});

app.post("/api/getCountry", (req, res) => {
  console.log("req--getCountry", req.body.params);
  //console.log("req.session",req.session);

  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.body.params.user;
  l_odoo_conn.password = req.body.params.pass;
  var odoo = new Odoo(l_odoo_conn);

  odoo.connect(function (err, uid) {
    if (err) {
      // return console.log(err);
      console.log(err)
      res.send({error: err})
      return;
    }
    console.log("Connected to Odoo server Cust Loc", req.body.params.user);
    var inParams = [];
    inParams.push([]);
    // inParams.push(0);  //offset
    // inParams.push(1);  //Limit
    var params = [];
    params.push(inParams);
    odoo.execute_kw("res.country", "search_read", params, function (err, value) {
      if (err) {
        // return console.log(err);
        console.log(err)
        res.send({error: err})
        return;
      }
      res.send(value)
      // console.log("res", value);
      // var inParams = [];
      // inParams.push(value); //ids
      // var params = [];
      // params.push(inParams);
      // odoo.execute_kw("res.country", "read", params, function (err2, value2) {
      //   if (err2) {
      //     return console.log(err2);
      //   }
      //   //console.log('Cust Loc: ', value2);
      //   res.send(value2);
      // });
    });
  });
});

app.post("/api/getState", (req, res) => {
  console.log("req--getState", req.body.params);
  //console.log("req.session",req.session);

  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.body.params.user;
  l_odoo_conn.password = req.body.params.pass;
  var odoo = new Odoo(l_odoo_conn);
  odoo.connect(function (err, uid) {
    if (err) {
      // return console.log(err);
      console.log(err)
      res.send({error: err})
      return;
    }
    console.log("Connected to Odoo server Cust Loc", Number(req.body.params.event));
    var inParams = [];
    inParams.push([["country_id", "=", Number(req.body.params.event)]]);
    // inParams.push(0);  //offset
    // inParams.push(1);  //Limit
    var params = [];
    params.push(inParams);
    odoo.execute_kw(
      "res.country.state",
      "search_read",
      params,
      function (err, value) {
        if (err) {
          // return console.log(err);
          console.log(err)
          res.send({error: err})
          return;
        }
        res.send(value)
        // console.log("res", value);
        // var inParams = [];
        // inParams.push(value); //ids
        // var params = [];
        // params.push(inParams);
        // odoo.execute_kw(
        //   "res.country.state",
        //   "read",
        //   params,
        //   function (err2, value2) {
        //     if (err2) {
        //       return console.log(err2);
        //     }
        //     //console.log('Cust Loc: ', value2);
        //     res.send(value2);
        //   }
        // );
      }
    );
  });
});

app.post("/api/dataTestEvents", (req, res) => {
  console.log("req--dataTestEvents", req.body.params);
  //console.log("req.session",req.session);

  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.body.params.user;
  l_odoo_conn.password = req.body.params.pass;
  var odoo = new Odoo(l_odoo_conn);

  odoo.connect(function (err, uid) {
    if (err) {
      // return console.log(err);
      console.log(err)
      res.send({error: err})
      return;
    }
    console.log("Connected to Odoo server test events");
    var inParams = [];
    inParams.push([]);
    //inParams.push(0);  //offset
    //inParams.push(6);  //Limit
    var params = [];
    params.push(inParams);
    odoo.execute_kw(
      "appointment.register",
      "search_read",
      params,
      function (err, value) {
        if (err) {
          // return console.log(err);
          console.log(err)
          res.send({error: err})
          return;
        }
        res.send(value)
        //console.log("res",value)
        // var inParams = [];
        // inParams.push(value); //ids

        // var params = [];
        // params.push(inParams);
        // odoo.execute_kw(
        //   "appointment.register",
        //   "read",
        //   params,
        //   function (err2, value2) {
        //     if (err2) {
        //       return console.log(err2);
        //     }
        //     //console.log('Result: ', value2);
        //     res.send(value2);
        //   }
        // );
      }
    );
  });
});

app.post("/api/dataTestEventsId", (req, res) => {
  console.log("req--dataTestEventsId", req.body.params);
  //console.log("req.session",req.session);

  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.body.params.user;
  l_odoo_conn.password = req.body.params.pass;
  var odoo = new Odoo(l_odoo_conn);

  odoo.connect(function (err, uid) {
    if (err) {
      // return console.log(err);
      console.log(err)
      res.send({error: err})
      return;
    }
    console.log("Connected to Odoo server test events");
    var inParams = [];
    inParams.push([
      ["company", "=", Number(req.body.params.custId)]
    ]);
    //inParams.push(0);  //offset
    //inParams.push(6);  //Limit
    var params = [];
    params.push(inParams);
    odoo.execute_kw(
      "appointment.register",
      "search_read",
      params,
      function (err, value) {
        if (err) {
          // return console.log(err);
          console.log(err)
          res.send({error: err})
          return;
        }
        res.send(value)
        //console.log("res",value)
        // var inParams = [];
        // inParams.push(value); //ids

        // var params = [];
        // params.push(inParams);
        // odoo.execute_kw(
        //   "appointment.register",
        //   "read",
        //   params,
        //   function (err2, value2) {
        //     if (err2) {
        //       return console.log(err2);
        //     }
        //     //console.log('Result: ', value2);
        //     res.send(value2);
        //   }
        // );
      }
    );
  });
});

app.post("/api/getReasons", (req, res) => {
  console.log("req--getReasons", req.body.params);
  //console.log("req.session",req.session);

  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.body.params.user;
  l_odoo_conn.password = req.body.params.pass;
  var odoo = new Odoo(l_odoo_conn);

  odoo.connect(function (err, uid) {
    if (err) {
      // return console.log(err);
      console.log(err)
      res.send({error: err})
      return;
    }
    console.log("Connected to Odoo server getReasons");
    var inParams = [];
    inParams.push([]);
    //inParams.push(0);  //offset
    //inParams.push(6);  //Limit
    var params = [];
    params.push(inParams);
    odoo.execute_kw(
      "reasons.register",
      "search_read",
      params,
      function (err, value) {
        if (err) {
          // return console.log(err);
          console.log(err)
          res.send({error: err})
          return;
        }
        res.send(value)
        //console.log("res",value)
        // var inParams = [];
        // inParams.push(value); //ids

        // var params = [];
        // params.push(inParams);
        // odoo.execute_kw(
        //   "reasons.register",
        //   "read",
        //   params,
        //   function (err2, value2) {
        //     if (err2) {
        //       return console.log(err2);
        //     }
        //     //console.log('Result: ', value2);
        //     res.send(value2);
        //   }
        // );
      }
    );
  });
});

// app.get("/api/getCompLogo", (req, res) => {
//   console.log("req--getCompLogo", req.query);
//   //console.log("req.session",req.session);

//   var odoo = new Odoo({
//     url: "https://odoo.digitalglyde.com",
//     port: "",
//     db: "digitalglyde2020db",
//     // username: 'admin',
//     // password: 'DGAdmin2020$'
//     username: req.query.user,
//     password: req.query.pass,
//   });

//   odoo.connect(function (err, uid) {
//     if (err) {
//       return console.log(err);
//     }
//     console.log("Connected to Odoo server getCompLogo");
//     var inParams = [];
//     inParams.push([]);
//     //inParams.push(0);  //offset
//     //inParams.push(6);  //Limit
//     var params = [];
//     params.push(inParams);
//     odoo.execute_kw(
//       "ir.attachment",
//       "search",
//       params,
//       function (err, value) {
//         if (err) {
//           return console.log(err);
//         }
//         //console.log("res",value)
//         var inParams = [];
//         inParams.push(value); //ids

//         var params = [];
//         params.push(inParams);
//         odoo.execute_kw(
//           "ir.attachment",
//           "read",
//           params,
//           function (err2, value2) {
//             if (err2) {
//               return console.log(err2);
//             }
//             console.log('Result logo: ', value2);
//             res.send(value2);
//           }
//         );
//       }
//     );
//   });
// });

app.post("/api/getClinics", (req, res) => {
  console.log("req--getClinics", req.body.params);
  //console.log("req.session",req.session);

  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.body.params.user;
  l_odoo_conn.password = req.body.params.pass;
  var odoo = new Odoo(l_odoo_conn);

  odoo.connect(function (err, uid) {
    if (err) {
      // return console.log(err);
      console.log(err)
      res.send({error: err})
      return;
    }
    console.log("Connected to Odoo server getClinics");
    var inParams = [];
    inParams.push([]);
    //inParams.push(0);  //offset
    //inParams.push(6);  //Limit
    var params = [];
    params.push(inParams);
    odoo.execute_kw(
      "clinics.register",
      "search_read",
      params,
      function (err, value) {
        if (err) {
          // return console.log(err);
          console.log(err)
          res.send({error: err})
          return;
        }
        res.send(value)
        //console.log("res",value)
        // var inParams = [];
        // inParams.push(value); //ids

        // var params = [];
        // params.push(inParams);
        // odoo.execute_kw(
        //   "clinics.register",
        //   "read",
        //   params,
        //   function (err2, value2) {
        //     if (err2) {
        //       return console.log(err2);
        //     }
        //     //console.log('Result: ', value2);
        //     res.send(value2);
        //   }
        // );
      }
    );
  });
});

app.post("/api/product_template", (req, res) => {
  console.log("req--product_template", req.body.params);
  //console.log("req.session",req.session);

  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.body.params.user;
  l_odoo_conn.password = req.body.params.pass;
  var odoo = new Odoo(l_odoo_conn);

  odoo.connect(function (err, uid) {
    if (err) {
      // return console.log(err);
      console.log(err)
      res.send({error: err})
      return;
    }
    console.log("Connected to Odoo server product_template");
    var inParams = [];
    inParams.push([]);
    //inParams.push(0);  //offset
    //inParams.push(6);  //Limit
    var params = [];
    params.push(inParams);
    odoo.execute_kw(
      "product.template",
      "search_read",
      params,
      function (err, value) {
        if (err) {
          // return console.log(err);
          console.log(err)
          res.send({error: err})
          return;
        }
        res.send(value)
        //console.log("res",value)
        // var inParams = [];
        // inParams.push(value); //ids

        // var params = [];
        // params.push(inParams);
        // odoo.execute_kw(
        //   "product.template",
        //   "read",
        //   params,
        //   function (err2, value2) {
        //     if (err2) {
        //       return console.log(err2);
        //     }
        //     //console.log('Result: ', value2);
        //     res.send(value2);
        //   }
        // );
      }
    );
  });
});

app.post("/api/getProtcol", (req, res) => {
  console.log("req--getProtcol", req.body.params);
  //console.log("req.session",req.session);

  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.body.params.user;
  l_odoo_conn.password = req.body.params.pass;
  var odoo = new Odoo(l_odoo_conn);

  odoo.connect(function (err, uid) {
    if (err) {
      // return console.log(err);
      console.log(err)
      res.send({error: err})
      return;
    }
    console.log("Connected to Odoo server getProtcol");
    var inParams = [];
    inParams.push([]);
    //inParams.push(0);  //offset
    //inParams.push(6);  //Limit
    var params = [];
    params.push(inParams);
    odoo.execute_kw(
      "protocol.testing",
      "search_read",
      params,
      function (err, value) {
        if (err) {
          // return console.log(err);
          console.log(err)
          res.send({error: err})
          return;
        }
        res.send(value)
        //console.log("res",value)
        // var inParams = [];
        // inParams.push(value); //ids

        // var params = [];
        // params.push(inParams);
        // odoo.execute_kw(
        //   "protocol.testing",
        //   "read",
        //   params,
        //   function (err2, value2) {
        //     if (err2) {
        //       return console.log(err2);
        //     }
        //     //console.log('Result: ', value2);
        //     res.send(value2);
        //   }
        // );
      }
    );
  });
});


app.post("/api/getPool", (req, res) => {
  console.log("req--getPool", req.body.params);

  //console.log("req.session",req.session);

  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.body.params.user;
  l_odoo_conn.password = req.body.params.pass;
  var odoo = new Odoo(l_odoo_conn);

  odoo.connect(function (err, uid) {
    if (err) {
      // return console.log(err);
      console.log(err)
      res.send({error: err})
      return;
    }
    console.log("Connected to Odoo server getPool");
    var inParams = [];
    inParams.push([
      ["id", "in", req.query.poolId]
    ]);
    // inParams.push([]);
    //inParams.push(0);  //offset
    //inParams.push(6);  //Limit
    var params = [];
    params.push(inParams);
    odoo.execute_kw("protocol.pool", "search_read", params, function (err, value) {
      if (err) {
        // return console.log(err);
        console.log(err)
          res.send({error: err})
          return;
      }
      res.send(value)
      //console.log("res",value)
      // var inParams = [];
      // inParams.push(value); //ids

      // var params = [];
      // params.push(inParams);
      // odoo.execute_kw("protocol.pool", "read", params, function (err2, value2) {
      //   if (err2) {
      //     return console.log(err2);
      //   }
      //   //console.log('Result: ', value2);
      //   res.send(value2);
      // });
    });
  });
});

app.get("/api/notificationsUpdated", (req, res) => {
  console.log("req--notificationsUpdated", req.query);
  //console.log("req.session",req.session);

  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.query.user;
  l_odoo_conn.password = req.query.pass;
  var odoo = new Odoo(l_odoo_conn);

  odoo.connect(function (err, uid) {
    if (err) {
      // return console.log(err);
      console.log(err)
      res.send({error: err})
      return;
    }
    console.log("Connected to Odoo server notificationsUpdated");
    var inParams = [];
    inParams.push([]);
    //inParams.push(0);  //offset
    //inParams.push(6);  //Limit
    var params = [];
    params.push(inParams);
    odoo.execute_kw(
      "portal.notification",
      "search_read",
      params,
      function (err, value) {
        if (err) {
          // return console.log(err);
          console.log(err)
          res.send({error: err})
          return;
        }
        res.send(value)
        //console.log("res",value)
        // var inParams = [];
        // inParams.push(value); //ids

        // var params = [];
        // params.push(inParams);
        // odoo.execute_kw(
        //   "portal.notification",
        //   "read",
        //   params,
        //   function (err2, value2) {
        //     if (err2) {
        //       return console.log(err2);
        //     }
        //     //console.log('Result: ', value2);
        //     res.send(value2);
        //   }
        // );
      }
    );
  });
});

app.post("/api/notifications", (req, res) => {
  console.log("req--notifications", req.body.params);
  // console.log("req.session custID::",req.session);

  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.body.params.user;
  l_odoo_conn.password = req.body.params.pass;
  var odoo = new Odoo(l_odoo_conn);

  odoo.connect(function (err, uid) {
    if (err) {
      // return console.log(err);
      console.log(err)
      res.send({error: err})
      return;
    }
    console.log("Connected to Odoo server notifications");
    var inParams = [];
    // inParams.push([]);
    inParams.push([
      ["company", "=", Number(req.body.params.custId)]
    ]);
    //inParams.push(0);  //offset
    //inParams.push(6);  //Limit
    var params = [];
    params.push(inParams);
    odoo.execute_kw(
      "hospital.notification",
      "search_read",
      params,
      function (err, value) {
        if (err) {
          // return console.log(err);
          console.log(err)
          res.send({error: err})
          return;
        }
        res.send(value)
        //console.log("res",value)
        // var inParams = [];
        // inParams.push(value); //ids

        // var params = [];
        // params.push(inParams);
        // odoo.execute_kw(
        //   "hospital.notification",
        //   "read",
        //   params,
        //   function (err2, value2) {
        //     if (err2) {
        //       return console.log(err2);
        //     }
        //     //console.log('Result: ', value2);
        //     res.send(value2);
        //   }
        // );
      }
    );
  });
});

app.post("/api/saveEmployee", (req, res) => {
  console.log("saveEmployee req.body:::::", req.body.params);
  // console.log("saveEmployee req.query:::::", req.query);

  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.body.params.user;
  l_odoo_conn.password = req.body.params.pass;
  var odoo = new Odoo(l_odoo_conn);

  odoo.connect(async (err)=> {
    if (err) {
      // return console.log(err);
      console.log(err)
      res.send({error: err})
      return;
    }
    console.log("Connected to Odoo server.");
    var inParams = [];
    inParams.push({
      first_name: req.body.params.firstNameNew,
      middle_name: req.body.params.middleNameNew,
      last_name: req.body.params.lastNameNew,
      //Suffix: req.body.params.suffixNew.toLowerCase(),
      DL: req.body.params.dlNew,
      mode: req.body.params.dotNew,
      Job_Title: req.body.params.jobTitleNew,
      emp_location: Number(req.body.params.locationNewA),
      Mobile: req.body.params.mobilePhone,
      Alternate_Phones: req.body.params.mobileNew,
      email: req.body.params.emailNew,
      Email_work: req.body.params.workEmailNew,
      street: req.body.params.streetNew,
      street2: req.body.params.street2New,
      zip: req.body.params.zipNew,
      city: req.body.params.cityNewA,
      state_id: req.body.params.stateNewA[0] ? Number(req.body.params.stateNewA[0]):0,
      country_id: req.body.params.countrNew[0] ? Number(req.body.params.countrNew[0]):0,
      emp_ssn: req.body.params.ssnNew,
      emp_status: req.body.params.statusNew.toLowerCase(),
      dob: req.body.params.dateNew,
      Gender: req.body.params.sexNew,
      company: Number(req.body.params.comNew),
    //   age: Number(req.body.params.age),
      age:req.body.params.dateNew,
      requestFrom : 'WEB'
    });

    var params = [];
    params.push(inParams);

    console.log("inParams",inParams)

    await odoo.execute_kw(
      "hospital.employee",
      "create",
      params,
      function (err, value) {
        if (err) {
          // return console.log(err);
          console.log(err)
          res.send({error: err})
          return;
        }
        //console.log('Result: ', value);
        res.send("Created Employee!!");
      }
    );

    // const newMessage = {
    //     from: config.emailSender, // Sender address
    //     to: req.query.emailNew, // List of recipients
    //     // bcc: config.bccRecipient,
    //     subject: "New Employee Added", // Subject line
    //     html: '<html><head><title>Link for Physical Intake Form </title><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/css/bootstrap.min.css"><script src="https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js"></script><script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/js/bootstrap.min.js"></script></head><body style="padding:30px;">'
    //         // + req.body.message[0].message_body.replace('"<',"<").replace(/\\n\"/g, '').replace(/\n/g, '')
    //         + 'Dear ' +req.query.firstNameNew +',</p>'
    //         + '<br />'
    //         + 'A new employee has been added in your company.</p>'
    //         + 'Please click on below link to fill intake form:-</p>'
    //         + '<br />'
    //         + '<a href="'+config.customer_portal_link+'/#/public/intakeform/'+ req.query.emailNew +'">Link</a>'
    //         + '<br /><br/>'
    //         + 'For any queries or clarification, please contact info@WorkplaceSafetyScreenings.com</p>'
    //         + '</div></div><br/><br/><div class="row" style="background-color:#dbdada"><div class="col-sm-4"></div> <div class="col-sm-4" style="font-size:16px;padding:10px;">'
    //         + '<b>Thank you<br/>WSS Team<br/></b></div><div class="col-sm-4"></div></div></div></body></html>'
    // };
    //
    // await wrapedSendMail(newMessage);


  });
});

app.post("/api/saveTest", (req, res) => {
  console.log("req.query::",req.body.params)
  res.send("Created Test Event!!");
  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.body.params.user;
  l_odoo_conn.password = req.body.params.pass;
  var odoo = new Odoo(l_odoo_conn);

  odoo.connect(function (err) {
    if (err) {
      // return console.log(err);
      console.log(err)
      res.send({error: err})
      return;
    }
    console.log("Connected to Odoo server add test events", req.body.params);

    let empArrD = [];

    _.each(req.body.params.assignToN, (empEve) => {
      empArrD.push(Number(empEve));
    });
    console.log("empArrD::", empArrD);
    var inParams = [];
    inParams.push({
      company: Number(req.body.params.compNameN),
      type_of_events: req.body.params.eventTypeN,
      reasons: req.body.params.reasonN,
      // reasons_name: Number(req.query.reasonN),
      service_multi_select: Number(req.body.params.serviceN),
      tree_field : req.body.params.tree_field,
      //'urgency_level': req.query.urgencyLevelN,
      //test_name: req.query.testNameN,
      child_ids: Number(req.body.params.locationEmpN),
      clinic_name: Number(req.body.params.clinicNameN),
      event_status: '',
      multi_select_employee: empArrD,
    });

    var params = [];
    params.push(inParams);

    console.log("params::::", params);

    odoo.execute_kw(
      "appointment.register",
      "create",
      params,
      function (err, value) {
        if (err) {
          // return console.log(err);
          console.log(err)
          res.send({error: err})
          return;
        }
        //console.log('Result: ', value);
        try {
          res.send("Created Test Event!!");
        } catch (e) {
          console.log("error", e);
        }
      }
    );

    //res.send("Created Test Event!!")
  });
}); 

app.get("/api/saveFormPhysical", (req, res) => {
  console.log("data::")
  let medicationsArr
  // res.send("Created Test Event!!")
  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.query.user;
  l_odoo_conn.password = req.query.pass;
  var odoo = new Odoo(l_odoo_conn);


  odoo.connect(function (err) {
    if (err) {
      // return console.log(err);
      console.log(err)
      res.send({error: err})
      return;
    }
    console.log("Connected to Odoo server saveFormPhysical", req.query);
    let mediArr =[];
    if(req.query.medicationArrOne.length>0){
      req.query.medicationArrOne.map((dat)=>{
        mediArr.push(JSON.parse(dat))
      })
    }
    console.log("mediArr::",mediArr)
    let alergyArr =[];
    if(req.query.allergyArrOne.length>0){
      req.query.allergyArrOne.map((dat)=>{
        alergyArr.push(JSON.parse(dat))
      })
    }
    console.log("alergyArr::",alergyArr)
    var inParams = [];
    inParams.push([]);
    inParams.push({
     
      // 'company': Number(req.query.compNameN),
          id:Number(req.query.empId),
          emp_name: req.query.employerName ? req.query.employerName:null,
          name: req.query.Name?req.query.Name:null,
          date:req.query.Date?req.query.Date:null,
          ila_no: req.query.ILAWorkNumber?req.query.ILAWorkNumber:null,
          telephone_one: req.query.Telephone?req.query.Telephone:null,
          emr_cont:req.query.EmergencyContact?req.query.EmergencyContact:null,
          telephone_two:req.query.Telephone2?req.query.Telephone2:null,
          relation:req.query.RelationEmergerncyContact?req.query.RelationEmergerncyContact:null,

          medi_array:mediArr,
          allergy_array:alergyArr,
          // dose:JSON.parse(req.query.medicationArrOne[0]).dose,
          // route:JSON.parse(req.query.medicationArrOne[0]).route,
          // frequency:JSON.parse(req.query.medicationArrOne[0]).frequency,
          // reason:JSON.parse(req.query.medicationArrOne[0]).reason,
          // how_long:JSON.parse(req.query.medicationArrOne[0]).how_long,
          // prescribed:JSON.parse(req.query.medicationArrOne[0]).prescribed,

          // allergies:JSON.parse(req.query.allergyArrOne[0]).allergies,
          // reaction_type:JSON.parse(req.query.allergyArrOne[0]).reaction_type,
          
          tetanus_date:req.query.DateofLastTetanusVaccination?req.query.DateofLastTetanusVaccination:null,
          // JSON.parse(req.query.TrackVisits[0])
          illness:JSON.parse(req.query.PastMedHistory[0]).prior_illness.reason?JSON.parse(req.query.PastMedHistory[0]).prior_illness.reason:null,
          illness_date:JSON.parse(req.query.PastMedHistory[0]).prior_illness.date?JSON.parse(req.query.PastMedHistory[0]).prior_illness.date:null,
          injury:JSON.parse(req.query.PastMedHistory[0]).injury.reason?JSON.parse(req.query.PastMedHistory[0]).injury.reason:null,
          injury_date:JSON.parse(req.query.PastMedHistory[0]).injury.date?JSON.parse(req.query.PastMedHistory[0]).injury.date:null,
          hospitalization:JSON.parse(req.query.PastMedHistory[0]).hospitalization.reason?JSON.parse(req.query.PastMedHistory[0]).hospitalization.reason:null,
          hospitalization_date:JSON.parse(req.query.PastMedHistory[0]).hospitalization.date?JSON.parse(req.query.PastMedHistory[0]).hospitalization.date:null,
          surgery:JSON.parse(req.query.PastMedHistory[0]).surgery.reason?JSON.parse(req.query.PastMedHistory[0]).surgery.reason:null,
          surgery_date:JSON.parse(req.query.PastMedHistory[0]).surgery.date?JSON.parse(req.query.PastMedHistory[0]).surgery.date:null,
          trauma:JSON.parse(req.query.PastMedHistory[0]).trauma.reason?JSON.parse(req.query.PastMedHistory[0]).trauma.reason:null,
          trauma_date:JSON.parse(req.query.PastMedHistory[0]).trauma.date?JSON.parse(req.query.PastMedHistory[0]).trauma.date:null,
          
          illness_injury:JSON.parse(req.query.healthHistory[0]).injury.option?JSON.parse(req.query.healthHistory[0]).injury.option:null,
          illness_injury_des:JSON.parse(req.query.healthHistory[0]).injury.desc?JSON.parse(req.query.healthHistory[0]).injury.desc:null,
          head_brain:JSON.parse(req.query.healthHistory[0]).head_brain_injury?JSON.parse(req.query.healthHistory[0]).head_brain_injury:null,
          Seizures_epilepsy:JSON.parse(req.query.healthHistory[0]).Seizures?JSON.parse(req.query.healthHistory[0]).Seizures:null,
          Medication_epilepsy:JSON.parse(req.query.healthHistory[0]).Medication_for_seizures_epilepsy?JSON.parse(req.query.healthHistory[0]).Medication_for_seizures_epilepsy:null,
          Eye_disorder:JSON.parse(req.query.healthHistory[0]).Eye_disorders_or_impaired_vision.option?JSON.parse(req.query.healthHistory[0]).Eye_disorders_or_impaired_vision.option:null,
          Eye_disorder_des:JSON.parse(req.query.healthHistory[0]).Eye_disorders_or_impaired_vision.desc?JSON.parse(req.query.healthHistory[0]).Eye_disorders_or_impaired_vision.desc:null,
          Ear_disorders:JSON.parse(req.query.healthHistory[0]).Ear_disorders_loss_of_hearing?JSON.parse(req.query.healthHistory[0]).Ear_disorders_loss_of_hearing:null,
          Heart_disease:JSON.parse(req.query.healthHistory[0]).Heart_disease?JSON.parse(req.query.healthHistory[0]).Heart_disease:null,
          Medication_heart:JSON.parse(req.query.healthHistory[0]).Medication_for_heart_condition?JSON.parse(req.query.healthHistory[0]).Medication_for_heart_condition:null,
          Heart_surgery:JSON.parse(req.query.healthHistory[0]).Heart_surgery?JSON.parse(req.query.healthHistory[0]).Heart_surgery:null,
          High_blood:JSON.parse(req.query.healthHistory[0]).High_blood_pressure?JSON.parse(req.query.healthHistory[0]).High_blood_pressure:null,
          Medication_high:JSON.parse(req.query.healthHistory[0]).Medication_for_high_blood_pressure?JSON.parse(req.query.healthHistory[0]).Medication_for_high_blood_pressure:null,
          Muscular_disease:JSON.parse(req.query.healthHistory[0]).Muscular_disease?JSON.parse(req.query.healthHistory[0]).Muscular_disease:null,
          Shortness_breath:JSON.parse(req.query.healthHistory[0]).Shortness_of_breath?JSON.parse(req.query.healthHistory[0]).Shortness_of_breath:null,
          Lung_disease:JSON.parse(req.query.healthHistory[0]).Lung_disease_emphysema?JSON.parse(req.query.healthHistory[0]).Lung_disease_emphysema:null,
          Kidney_disease:JSON.parse(req.query.healthHistory[0]).Kidney_disease_dialysis?JSON.parse(req.query.healthHistory[0]).Kidney_disease_dialysis:null,
          Liver_disease:JSON.parse(req.query.healthHistory[0]).Liver_disease?JSON.parse(req.query.healthHistory[0]).Liver_disease:null,
          Digestive_problems:JSON.parse(req.query.healthHistory[0]).Digestive_problems?JSON.parse(req.query.healthHistory[0]).Digestive_problems:null,
          Diabetes_blood:JSON.parse(req.query.healthHistory[0]).Diabetes_or_elevated_blood_sugar.option?JSON.parse(req.query.healthHistory[0]).Diabetes_or_elevated_blood_sugar.option:null,
          Diabetes_blood_cont:JSON.parse(req.query.healthHistory[0]).Diabetes_or_elevated_blood_sugar.desc?JSON.parse(req.query.healthHistory[0]).Diabetes_or_elevated_blood_sugar.desc:null,
          Nervous_psychiatric:JSON.parse(req.query.healthHistory[0]).Nervous_or_psychiatric_disorder?JSON.parse(req.query.healthHistory[0]).Nervous_or_psychiatric_disorder:null,
          Medication_nervous:JSON.parse(req.query.healthHistory[0]).Medication_for_nervous_or_psychiatric_disorder?JSON.parse(req.query.healthHistory[0]).Medication_for_nervous_or_psychiatric_disorder:null,
          Loss_altered:JSON.parse(req.query.healthHistory[0]).Loss_of_or_altered_consciousness?JSON.parse(req.query.healthHistory[0]).Loss_of_or_altered_consciousness:null,
          Fainting_dizziness:JSON.parse(req.query.healthHistory[0]).Fainting_dizziness?JSON.parse(req.query.healthHistory[0]).Fainting_dizziness:null,
          Sleep_disorders:JSON.parse(req.query.healthHistory[0]).Sleep_disorders_pauses_in_breathing?JSON.parse(req.query.healthHistory[0]).Sleep_disorders_pauses_in_breathing:null,
          Stroke_paralysis:JSON.parse(req.query.healthHistory[0]).Stroke_or_paralysis?JSON.parse(req.query.healthHistory[0]).Stroke_or_paralysis:null,
          Missing_impaired:JSON.parse(req.query.healthHistory[0]).Missing_or_impaired_hand_arm_foot?JSON.parse(req.query.healthHistory[0]).Missing_or_impaired_hand_arm_foot:null,
          Spinal_injury:JSON.parse(req.query.healthHistory[0]).Spinal_injury_or_disease?JSON.parse(req.query.healthHistory[0]).Spinal_injury_or_disease:null,
          Chronic_low:JSON.parse(req.query.healthHistory[0]).Chronic_low_back_pain?JSON.parse(req.query.healthHistory[0]).Chronic_low_back_pain:null,
          Regular_alcohol:JSON.parse(req.query.healthHistory[0]).Regular_frequent_alcohol_use?JSON.parse(req.query.healthHistory[0]).Regular_frequent_alcohol_use:null,
          Narcotic_drug:JSON.parse(req.query.healthHistory[0]).Narcotic_or_habit_forming_drug_use?JSON.parse(req.query.healthHistory[0]).Narcotic_or_habit_forming_drug_use:null,
          health_history_res:JSON.parse(req.query.healthHistory[0]).diagnosis?JSON.parse(req.query.healthHistory[0]).diagnosis:null,

          // worker_sign_date:req.query.SignDate?req.query.SignDate:null
      // EmergencyContact: req.query.EmergencyContact,
    });
    console.log("inParams:::",inParams)
    var params = [];
    params.push(inParams);

    console.log("params saveFormPhysical::::", params);

    odoo.execute_kw('hospital.employee', 'physical_write', params, function (err, value) {
      if (err) {
      console.log(err)
          res.send({error: err})
          return;
      }
      res.send("Created Physical Form!!")
        // if (err) { return console.log(err); }
        // //console.log('Result: ', value);
        // try {
        //     res.send("Created Physical Form!!")
        // } catch (e) {
        //     console.log("error", e)
        //     res.send("error!!")
        // }
    });
  });
});

app.get("/api/saveFormIntake", (req, res) => {
  // res.send("Created Test Event!!")

  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.query.user;
  l_odoo_conn.password = req.query.pass;
  var odoo = new Odoo(l_odoo_conn);

  odoo.connect(function (err) {
    if (err) {
      // return console.log(err);
      console.log(err)
      res.send({error: err})
      return;
    }
    console.log("Connected to Odoo server saveFormIntake", req.query);

    var inParams = [];
    inParams.push([]);
    inParams.push({

      patientFirstName: req.query.patientFirstName,
      patientMiddleName: req.query.patientMiddleName,
      patientLastName: req.query.patientLastName,
      DateofBirth: req.query.DateofBirth,
      gender: req.query.gender,
      id : Number(req.query.id),
      Nationality: req.query.Nationality,

      EINSSNPassportno: req.query.EINSSNPassportno,
      JobTitle: req.query.JobTitle,
      MobileNumber: req.query.MobileNumber,
      Email: req.query.Email,
      Alternatecontactinformation: req.query.Alternatecontactinformation,

      firstVisitDate: JSON.parse(req.query.TrackVisits[0]).firstVisitDate,
      Timein: JSON.parse(req.query.TrackVisits[0]).Timein,
      Timeout: JSON.parse(req.query.TrackVisits[0]).Timeout,
      CareProvided: JSON.parse(req.query.TrackVisits[0]).CareProvided,
      Height_feet: JSON.parse(req.query.TrackVisits[0]).Height.feet,
      Height_inch: JSON.parse(req.query.TrackVisits[0]).Height.inch,
      Weight: JSON.parse(req.query.TrackVisits[0]).Weight,

      medicationArr: req.query.medicationArr,
      allergyArr: req.query.allergyArr,

      Priorillness: JSON.parse(req.query.PastMedicalSurgicalTraumaHistory[0]).Priorillness,
      Injury: JSON.parse(req.query.PastMedicalSurgicalTraumaHistory[0]).Injury,
      Hospitalization: JSON.parse(req.query.PastMedicalSurgicalTraumaHistory[0]).Hospitalization,
      Surgery: JSON.parse(req.query.PastMedicalSurgicalTraumaHistory[0]).Surgery,
      Trauma: JSON.parse(req.query.PastMedicalSurgicalTraumaHistory[0]).Trauma,

      Smoking: JSON.parse(req.query.Howlonghowmuch[0]).Smoking,
      Alcohol: JSON.parse(req.query.Howlonghowmuch[0]).Alcohol,
      Sleephours: JSON.parse(req.query.Howlonghowmuch[0]).Sleephours,
      Exercise: JSON.parse(req.query.Howlonghowmuch[0]).Exercise,
      Weight_lossgain: JSON.parse(req.query.Howlonghowmuch[0]).Weight.lossgain,
      Weight_suddenslow: JSON.parse(req.query.Howlonghowmuch[0]).Weight.suddenslow,

      Vision_option: JSON.parse(req.query.VisionHearing[0]).Vision.option,
      Vision_desc: JSON.parse(req.query.VisionHearing[0]).Vision.desc,
      Hearing_option: JSON.parse(req.query.VisionHearing[0]).Hearing.option,
      Hearing_desc: JSON.parse(req.query.VisionHearing[0]).Hearing.desc,
      Pulse_option1: JSON.parse(req.query.VisionHearing[0]).Pulse.option1,
      Pulse_option2: JSON.parse(req.query.VisionHearing[0]).Pulse.option2,
      BloodPressure_option1: JSON.parse(req.query.VisionHearing[0]).BloodPressure.option1,
      BloodPressure_option2: JSON.parse(req.query.VisionHearing[0]).BloodPressure.option2,
      Edema_option: JSON.parse(req.query.VisionHearing[0]).Edema.option,
      Edema_desc: JSON.parse(req.query.VisionHearing[0]).Edema.desc,
      BloodSugar_Fasting: JSON.parse(req.query.VisionHearing[0]).BloodSugar.Fasting,
      BloodSugar_NonFasting: JSON.parse(req.query.VisionHearing[0]).BloodSugar.NonFasting,
      BloodSugar_Timesincelastmedication: JSON.parse(req.query.VisionHearing[0]).BloodSugar.Timesincelastmedication,
      Pacemaker_Kind: JSON.parse(req.query.VisionHearing[0]).Pacemaker.Kind,
      Pacemaker_Timeofplacement: JSON.parse(req.query.VisionHearing[0]).Pacemaker.Timeofplacement,
      Pacemaker_Place: JSON.parse(req.query.VisionHearing[0]).Pacemaker.Place,
      Pacemaker_LastChecked: JSON.parse(req.query.VisionHearing[0]).Pacemaker.LastChecked,
      Respirationproblems_option: JSON.parse(req.query.VisionHearing[0]).Respirationproblems.option,
      Respirationproblems_desc: JSON.parse(req.query.VisionHearing[0]).Respirationproblems.desc,
      LungSounds_option: JSON.parse(req.query.VisionHearing[0]).LungSounds.option,
      LungSounds_desc: JSON.parse(req.query.VisionHearing[0]).LungSounds.desc,
      Cough_option: JSON.parse(req.query.VisionHearing[0]).Cough.option,
      Cough_ProductiveAmount: JSON.parse(req.query.VisionHearing[0]).Cough.ProductiveAmount,
      Cough_color: JSON.parse(req.query.VisionHearing[0]).Cough.color,
      Cough_howoften: JSON.parse(req.query.VisionHearing[0]).Cough.howoften,


    });

    var params = [];
    params.push(inParams);

    console.log("params saveFormIntake::::", params);

    odoo.execute_kw('hospital.employee', 'intake_write', params, function (err, value) {
        if (err) { 
          // return console.log(err); 
          console.log(err)
          res.send({error: err})
          return;
        }
        //console.log('Result: ', value);
        try {
            res.send("Created Intake Form!!")
        } catch (e) {
            console.log("error", e)
        }
    });

    // odoo.execute_kw('employee.intake', 'create', params, function (err, value) {
    //     if (err) { return console.log(err); }
    //     //console.log('Result: ', value);
    //     try {
    //         res.send("Created Intake Form!!")
    //     } catch (e) {
    //         console.log("error", e)
    //     }
    // });
  });
});

app.get("/api/saveLocation", (req, res) => {
  console.log("saveLocation req.query:::::", req.query);

  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.query.user;
  l_odoo_conn.password = req.query.pass;
  var odoo = new Odoo(l_odoo_conn);

  odoo.connect(async (err)=> {
    if (err) {
      // return console.log(err);
      console.log(err)
      res.send({error: err})
      return;
    }
    console.log("Connected to Odoo server.");
    var inParams = [];
    inParams.push({
      location_name: req.query.location_name,
      
      street: req.query.streetNew,
      street2: req.query.street2New,
      zip: req.query.zipNew,
      city: req.query.cityNewA,
      state_id: req.query.stateNewA[0] ? Number(req.query.stateNewA[0]):0,
      country_id: req.query.countrNew[0] ? Number(req.query.countrNew[0]):0,
     
    });

    var params = [];
    params.push(inParams);

    console.log("inParams",inParams)

    await odoo.execute_kw(
      "hospital.employee",
      "create",
      params,
      function (err, value) {
        if (err) {
          // return console.log(err);
          console.log(err)
          res.send({error: err})
          return;
        }
        //console.log('Result: ', value);
        res.send("Created Employee!!");
      }
    );

  })
})

// var Odoo = require('node-odoo');

// var odoo = new Odoo({
//   host: '192.168.2.63',
//   port: 5433,
//   database: 'tmdatabase',
//   username: 'tm',
//   password: '8755947425'
// });

// Connect to Odoo
// odoo.connect(function (err) {
//   if (err) {
//        return console.log(err);
//      }else{

//         console.log("connected odoo")
//      }

// Get a partner
//   odoo.get('res.partner', 4, function (err, partner) {
//     if (err) { return console.log(err); }

//     console.log('Partner', partner);
//   });
// });



// app.get('/api/patientListOrg', (req, res) => {
//   try{
//     odoo.connect(function (err,result) {
//   if (err) {
//      console.log("connection error ::     ",err);
//      }else{

//         console.log("connected odoo")
//      }
//     })
//   }
//   catch(e){
//          console.log("connection error ::     ",e);

//   }
//   pool.query('SELECT * FROM hospital_patient;', (error, results) => {
//     if (error) {
//       throw error
//     }else{

//         console.log("results",results.rows);
//         res.send(results.rows);

//     }
//    // response.status(200).json(results.rows)
//   })
// });

app.post("/api/hospital_customers_lines", (req, res) => {
  console.log("req--hospital_customers_lines", req.body.params);
  //console.log("req.session",req.session);

  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.body.params.user;
  l_odoo_conn.password = req.body.params.pass;
  var odoo = new Odoo(l_odoo_conn);

  odoo.connect(function (err, uid) {
    if (err) {
      // return console.log(err);
      console.log(err)
      res.send({error: err})
      return;
    }
  //   console.log("Connected to Odoo server Cust EmployeeInfo", req.query.user);
    var inParams = [];
    inParams.push([
      ["company", "=", Number(req.body.params.compId)]
    ]);
    // inParams.push([]);
    // inParams.push(0);  //offset
    // inParams.push(1);  //Limit
    var params = [];
    params.push(inParams);
    odoo.execute_kw("hospital.customers.lines", "search_read", params, function (err, value) {
      if (err) {
        // return console.log(err);
        console.log(err)
          res.send({error: err})
          return;
      }
      res.send(value)
      // console.log("res", value);
      // var inParams = [];
      // inParams.push(value); //ids
      // var params = [];
      // params.push(inParams);
      // odoo.execute_kw("hospital.customers.lines", "read", params, function (err2, value2) {
      //   if (err2) {
      //     return console.log(err2);
      //   }
      //   //console.log('Cust Loc: ', value2);
      //   res.send(value2);
      // });
    });
  });
});



app.get("/api/EmployeeInfo", (req, res) => {
    console.log("req--EmployeeInfo", req.query);
    //console.log("req.session",req.session);

  var l_odoo_conn = config.odoo_conn;
  l_odoo_conn.username = req.query.user;
  l_odoo_conn.password = req.query.pass;
  var odoo = new Odoo(l_odoo_conn);
  
    odoo.connect(function (err, uid) {
      if (err) {
        // return console.log(err);
        console.log(err)
      res.send({error: err})
      return;
      }
    //   console.log("Connected to Odoo server Cust EmployeeInfo", req.query.user);
      var inParams = [];
      inParams.push([
        ["authorisation_token_physical", "=", req.query.token]
      ]);
      // inParams.push([]);
      // inParams.push(0);  //offset
      // inParams.push(1);  //Limit
      var params = [];
      params.push(inParams);
      odoo.execute_kw("hospital.employee", "search_read", params, function (err, value) {
        if (err) {
          // return console.log(err);
          console.log(err)
          res.send({error: err})
          return;
        }
        res.send(value)
        // console.log("res", value);
        // var inParams = [];
        // inParams.push(value); //ids
        // var params = [];
        // params.push(inParams);
        // odoo.execute_kw("hospital.employee", "read", params, function (err2, value2) {
        //   if (err2) {
        //     return console.log(err2);
        //   }
        //   //console.log('Cust Loc: ', value2);
        //   res.send(value2);
        // });
      });
    });
  });


  app.post("/api/Covid_test", (req, res) => {
    console.log("req--Covid_test", req.body.params);
    //console.log("req.session",req.session);

    var l_odoo_conn = config.odoo_conn;
    l_odoo_conn.username = req.body.params.user;
    l_odoo_conn.password = req.body.params.pass;
    var odoo = new Odoo(l_odoo_conn);
  
    odoo.connect(function (err, uid) {
      if (err) {
        // return console.log(err);
        console.log(err)
      res.send({error: err})
      return;
      }
    //   console.log("Connected to Odoo server Cust EmployeeInfo", req.query.user);
      var inParams = [];
      inParams.push([
        ["company", "=", Number(req.body.params.customerId)]
      ]);

    //   inParams.push(['Gender', 'company', 'country_id','create_date','display_name','dob',
    // 'email','emp_location','emp_ssn','emp_status','last_name','first_name','program','reasons',
    // 'report_date','requestFrom','state_id','middle_name','mode','nationality','street','street2',
    // 'telephone','users','zip','__last_update','Mobile', 'covid_tests', 'covid_vaccination']);

      // inParams.push([]);
      // inParams.push(0);  //offset
      // inParams.push(1);  //Limit
      var params = [];
      params.push(inParams);
      odoo.execute_kw("covid.testing", "search_read", params, function (err, value) {
        if (err) {
          // return console.log(err);
          console.log(err)
          res.send({error: err})
          return;
        }
        res.send(value);
        // console.log("res", value);
        // var inParams = [];
        // inParams.push(value); //ids
        // var params = [];
        // params.push(inParams);
        // odoo.execute_kw("covid.testing", "read", params, function (err2, value2) {
        //   if (err2) {
        //     return console.log(err2);
        //   }
        //   //console.log('Cust Loc: ', value2);
        //   res.send(value2);
        // });
      });
    });
  });

  app.post("/api/Covid_Vaccination", (req, res) => {
    console.log("req--Covid_Vaccination", req.body.params);
    //console.log("req.session",req.session);

    var l_odoo_conn = config.odoo_conn;
    l_odoo_conn.username = req.body.params.user;
    l_odoo_conn.password = req.body.params.pass;
    var odoo = new Odoo(l_odoo_conn);
  
    odoo.connect(function (err, uid) {
      if (err) {
        // return console.log(err);
        console.log(err)
      res.send({error: err})
      return;
      }
    //   console.log("Connected to Odoo server Cust EmployeeInfo", req.query.user);
      var inParams = [];
      inParams.push([
        ["company", "=", Number(req.body.params.customerId)]
      ]);
      // inParams.push([]);
      // inParams.push(0);  //offset
      // inParams.push(1);  //Limit
      var params = [];
      params.push(inParams);
      odoo.execute_kw("covid.vaccination", "search_read", params, function (err, value) {
        if (err) {
          // return console.log(err);
          console.log(err)
          res.send({error: err})
          return;
        }
        res.send(value);
        // console.log("res", value);
        // var inParams = [];
        // inParams.push(value); //ids
        // var params = [];
        // params.push(inParams);
        // odoo.execute_kw("covid.vaccination", "read", params, function (err2, value2) {
        //   if (err2) {
        //     return console.log(err2);
        //   }
        //   //console.log('Cust Loc: ', value2);
        //   res.send(value2);
        // });
      });
    });
  });




// Download Covid Testing Certificate

app.post("/api/downloadTestingCertificate", (req, res) => {
  console.log("saveCovidTesting Certificate req.query:::::",req);
  var bucket_name=req.body.params.attachment_url.split('.s3')[0].split('https://')[1]
  var fileName = req.body.params.attachment_url.split('.com/').pop().split('?')[0];
  console.log("filename Body :",fileName);
        var params = {Bucket: bucket_name, Key: fileName};
        s3.getSignedUrl('getObject', params, function (err, url) {
          console.log('The URL is', url);
          res.send(url);
        });
     
});

//Download Covid Vaccine Certificate 


app.get("/api/downloadVaccineCertificate", async (req, res) => {
  console.log("saveVaccination Certificate req.query:::::",req.query.attachment_detail);
  if (Array.isArray(req.query.attachment_detail)) {
    let ids = req.query.attachment_detail.join(",");
    const result = await pool.query('SELECT * from ir_attachment where id IN ('+ids+')');
    console.log("training courses:::",result.rows);
    if(result.rows && result.rows.length>0){
      let imageUrls = [];
      result.rows.map((imgData, index) => {
          console.log("imgData :", fileName);
          var bucket_name = imgData.url.split('.s3')[0].split('https://')[1]
          var fileName = imgData.name
          console.log("filename Body :", fileName);
          var params = { Bucket: bucket_name, Key: fileName };
          console.log("params :: ", params);
          s3.getSignedUrl('getObject', params, function (err, url) {
            console.log('The URL is', url);
            params['fileType'] = imgData.mimetype;
            imageUrls.push({...params,url});
            if(result.rows.length === index+1){
              console.log("imageUrls :: ", imageUrls);
              res.send(imageUrls);
            }
          });
      })
    }
  } else {
    var bucket_name=req.query.attachment_detail.split('.s3')[0].split('https://')[1]
    var fileName = req.query.attachment_detail.split('.com/').pop().split('?')[0];
    console.log("filename Body :", fileName);
    var params = { Bucket: bucket_name, Key: fileName };
    s3.getSignedUrl('getObject', params, function (err, url) {
      console.log('The URL is', url);
      res.send(url);
    });
  }
  });

// app.post("/api/downloadVaccineCertificate", (req, res) => {
//   console.log("saveVaccination Certificate req.query:::::",req.body.params.attachment_detail);
//   if (Array.isArray(req.body.params.attachment_detail)) {
//     odoo.connect(async (err) => {
//       if (err) {
//         // return console.log(err);
//         console.log(err)
//       res.send({error: err})
//       return;
//       }
//       console.log("Connected to Odoo server.");
//       var inParams = [];
//       inParams.push([["id", "=", Number(req.body.params.attachment_detail[0])]]);
//       var params = [];
//       params.push(inParams);
//       console.log("inParams", inParams)
//       odoo.execute_kw("ir.attachment", "search", params, function (err, value) {
//         if (err) {
//           // return console.log("attachment",err);
//           console.log(err)
//           res.send({error: err})
//           return;
//         }
//         console.log("res", value);
//         var inParams = [];
//         inParams.push(value); //ids
//         var params = [];
//         params.push(inParams);
//         odoo.execute_kw("ir.attachment", "read", params, function (err2, value2) {
//           if (err2) {
//             return console.log(err2);
//           }
//           console.log('sattachment value: ', value2);
//           var bucket_name = value2.website_url.split('.s3')[0].split('https://')[1]
//           var fileName = value2.website_url.split('.com/').pop().split('?')[0];
//           console.log("filename Body :", fileName);
//           var params = { Bucket: bucket_name, Key: fileName };
//           s3.getSignedUrl('getObject', params, function (err, url) {
//             console.log('The URL is', url);
//             res.send(url);
//           });
//         });
//       });
//     });
//   } else {
//     var bucket_name=req.body.params.attachment_detail.split('.s3')[0].split('https://')[1]
//     var fileName = req.body.params.attachment_detail.split('.com/').pop().split('?')[0];
//     console.log("filename Body :", fileName);
//     var params = { Bucket: bucket_name, Key: fileName };
//     s3.getSignedUrl('getObject', params, function (err, url) {
//       console.log('The URL is', url);
//       res.send(url);
//     });
//   }
//   });




async function wrapedSendMail(mailOptions) {
    console.log("REGULAR complete email", JSON.stringify(mailOptions), JSON.stringify(config.transportOptions));
    return new Promise((resolve, reject) => {
        transport.sendMail(mailOptions, function (error, info) {
            if (error) {
                console.log("error is " + error);
                resolve(error); // or use reject(false) but then you will have to handle errors
            }
            else {
                console.log('Email sent: ' + info.response);
                resolve(info);
            }
        });
    })
}

app.listen(3001, () =>
  console.log("Express server is running on localhost:3001")
);
