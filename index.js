//const Odoo = require('react-odoo');
const express = require("express");
var fs = require("fs");
const config = require("./key");
const bodyParser = require("body-parser");
const pino = require("express-pino-logger")();
// const Pool = require("pg").Pool;
const cors = require("cors");
const nodemailer = require("nodemailer");
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

var AWS = require("aws-sdk");
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

const { Pool, Client } = require("node-postgres");

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

// app.post('/VerifyOTP', (req, res) => {
app.post("/VerifyOTP", async (req, res) => {
  console.log("saveEmployee req.body:::::", req.body.params);
  let reqData = req.body.params;
  console.log("VerifyOTP", reqData);

  odoo.connect(function (err, email) {
    if (err) {
      console.log("first error", err);
    }
    //   console.log("Connected to Odoo server Cust EmployeeInfo", req.query.user);
    var inParams = [];
    email_lower = reqData.email.toLowerCase().trim();
    inParams.push([["email", "ilike", email_lower]]);
    console.log("myemail is", email_lower);
    inParams.push([]);
    // inParams.push(0);  //offset
    // inParams.push(1);  //Limit
    var params = [];
    params.push(inParams);

    odoo.execute_kw(
      "hospital.employee",
      "search",
      params,
      function (err, value) {
        if (err) {
          console.log("Error detected", err);
        }
        console.log("res", value);
        var inParams = [];
        inParams.push(value); //ids
        var params = [];
        params.push(inParams);
        odoo.execute_kw(
          "hospital.employee",
          "read",
          params,
          async function (err2, value2) {
            if (err2) {
              return console.log(err2);
            }
            // console.log('email: ', value2);

            // let queryStr = "SELECT id, company, first_name, last_name, dob, email FROM hospital_employee WHERE email = '" + reqData.email+"'";
            // console.log('queryStr', queryStr);

            // const result = await pool.query(queryStr)

            // '${moment(result.rows[0].dob).format("MM-DD-YYYY")}'
            if (value2 && value2.length > 0) {
              let otpQueryStr =
                "SELECT * FROM hospital_employee_otp WHERE upper(email) = upper('" +
                reqData.email.trim() +
                "') and trim(otp)='" +
                reqData.otp.trim() +
                "' and trim(dob)='" +
                moment(reqData.dob.trim()).format("MM-DD-YYYY") +
                "'";
              console.log("otpQueryStr", otpQueryStr);

              const otpResult = await pool.query(otpQueryStr);

              if (otpResult.rows && otpResult.rows.length > 0) {
                console.log(
                  "hospital_employee_otp::::::::::::::::::::::::::::",
                  otpResult.rows
                );
                res.send(value2[0]);
              } else {
                res.send({ error: "OTP/DOB does not match." });
              }
            } else {
              res.send({ error: "user not found" });
            }
          }
        );
      }
    );
  });
});

app.get("/api/Covid_test", (req, res) => {
  console.log("req--Covid_test", req.query);
  odoo.connect(function (err, uid) {
    if (err) {
      return console.log(err);
    }
    var inParams = [];
    inParams.push([
      ["company", "=", Number(req.query.customerId)],
      ["employee", "=", Number(req.query.employeeId)],
    ]);
    var params = [];
    params.push(inParams);
    odoo.execute_kw("covid.testing", "search", params, function (err, value) {
      if (err) {
        return console.log(err);
      }
      console.log("res", value);
      var inParams = [];
      inParams.push(value); //ids
      var params = [];
      params.push(inParams);
      odoo.execute_kw("covid.testing", "read", params, function (err2, value2) {
        if (err2) {
          return console.log(err2);
        }
        res.send(value2);
      });
    });
  });
});

app.get("/api/CustomerData", (req, res) => {
  console.log("req--CustomerData", req.query);
  //console.log("req.session",req.session);

  var odoo = new Odoo({
    url: "https://odoo.digitalglyde.com",
    port: "",
    db: "digitalglyde2020db",
    // username: 'admin',
    // password: 'DGAdmin2020$'
    username: req.query.user,
    password: req.query.pass,
  });

  odoo.connect(function (err, uid) {
    if (err) {
      return console.log(err);
    }
    console.log("Connected to Odoo server Cust Loc", req.query.user);
    var inParams = [];
    // inParams.push([['email', '=', req.query.user],['is_company', '=', true]]);
    inParams.push([["login", "in", uid]]);
    // inParams.push(0);  //offset
    // inParams.push(1);  //Limit
    var params = [];
    params.push(inParams);
    odoo.execute_kw("res.partner", "search", params, function (err, value) {
      if (err) {
        return console.log(err);
      }
      console.log("res", value);
      var inParams = [];
      inParams.push(value); //ids
      var params = [];
      params.push(inParams);
      odoo.execute_kw("res.partner", "read", params, function (err2, value2) {
        if (err2) {
          return console.log(err2);
        }
        //console.log('Cust Loc: ', value2);
        res.send(value2);
      });
    });
  });
});

app.get("/api/getCustomerLocation", (req, res) => {
  console.log("req--getCustomerLocation", req.query);
  //console.log("req.session",req.session);
  odoo.connect(function (err, uid) {
    if (err) {
      return console.log(err);
    }
    console.log("Connected to Odoo server getCustomerLocation", req.query.user);
    var inParams = [];
    inParams.push([
      ["commercial_partner_id", "=", Number(req.query.companyId)],
      ["is_company", "=", false],
      ["type", "=", "other"],
    ]);
    var params = [];
    params.push(inParams);
    odoo.execute_kw("res.partner", "search", params, function (err, value) {
      if (err) {
        return console.log(err);
      }
      console.log("res", value);
      var inParams = [];
      inParams.push(value); //ids
      var params = [];
      params.push(inParams);
      odoo.execute_kw("res.partner", "read", params, function (err2, value2) {
        if (err2) {
          return console.log(err2);
        }
        //console.log('Cust Loc: ', value2);
        res.send(value2);
      });
    });
  });
});

app.get("/api/Covid_Vaccination_qr_code", (req, res) => {
  console.log("Covid_Vaccination_qr_code::",req.query)
  odoo.connect(function (err, uid) {
    if (err) {
      return console.log(err);
    }
    var inParams = [];
    inParams.push([
      ["barcode_token", "=", req.query.vacc_id],
      // ["company", "=", Number(req.query.companyId)],
      // ["employee", "=", Number(req.query.employeeId)],
      // ["event_id", "=", Number(req.query.event_id)]
    ]);
    console.log("inParams:::",inParams)
    var params = [];
    params.push(inParams);
    
    odoo.execute_kw(
      "covid.vaccination",
      "search_read",
      params,
      function (err, value) {
        if (err) {
          return console.log(err);
        }
        console.log("res qr value", value);
        res.send(value);
      }
    );
  });
});

app.get("/api/Covid_Vaccination", (req, res) => {
  odoo.connect(function (err, uid) {
    if (err) {
      return console.log(err);
    }
    var inParams = [];
    inParams.push([
      ["company", "=", Number(req.query.customerId)],
      ["employee", "=", Number(req.query.employeeId)],
    ]);

    var params = [];
    params.push(inParams);
    odoo.execute_kw(
      "covid.vaccination",
      "search",
      params,
      function (err, value) {
        if (err) {
          return console.log(err);
        }
        console.log("res", value);
        var inParams = [];
        inParams.push(value); //ids
        var params = [];
        params.push(inParams);
        odoo.execute_kw(
          "covid.vaccination",
          "read",
          params,
          function (err2, value2) {
            if (err2) {
              return console.log(err2);
            }
            //console.log('Cust Loc: ', value2);
            res.send(value2);
          }
        );
      }
    );
  });
});

// save covid test api
app.post("/api/saveCovidTesting", (req, res) => {
  console.log("saveCovidTesting req.query:::::");
  const form = formidable({ multiples: true });
  form.parse(req, async (err, fields, files) => {
    var file = "";

    let fileName = "";

    var date = new Date();
    let keyNameForS3 = "";

    let url = "";
    if (files.photo_pdf) {
      file = files.photo_pdf;
      console.log("fields ", file);
      fileName = file.originalFilename;
      keyNameForS3 =
        "COVID_TESTING_" + date.getTime() + "_" + sanitize(fileName, "");
      url = "https://wss-files.s3.amazonaws.com/" + keyNameForS3;
      console.log("fileName ", fileName);

      fs.readFile(file.filepath, (err, data) => {
        if (err) throw err;
        // console.log("data is ",data)
        const params = {
          Bucket: "wss-files", // pass your bucket name
          Key: keyNameForS3, // file will be saved as testBucket/contacts.csv
          //ACL: 'public-read',
          ContentType: file.mimetype,
          ContentDisposition: "inline; filename=" + fileName,
          Body: data,
        };

        s3.putObject(params, function (s3Err, data) {
          if (s3Err) {
            res.send("Techinical Issue");
          } else {
            console.log(`File uploaded successfully at ${data.Location}`);
            console.log("Save covid testing api ", odoo);
            odoo.connect(async (err) => {
              if (err) {
                return console.log("connect 4error", err);
              }
              console.log("Save covid testing api ");
              var inParams = [];
              inParams.push([]);
              inParams.push({
                event_id: "",
                company: Number(fields.compNameN),
                child_ids: Number(fields.location),
                employee: Number(fields.employee),
                id: Number(fields.employee),
                sex: fields.sex == "undefined" ? "Male" : fields.sex,
                dob: fields.dob,
                email: fields.emailN,
                test_date: fields.test_date,
                test_type: fields.test_type,
                attachment_url: url.length > 0 ? url : null,
                test_result: fields.testing_result,
                testing_status: "pending",
                conducted_by: "ODOO-PORTAL",
              });

              var params = [];
              params.push(inParams);

              console.log("inParams", inParams);

              await odoo.execute_kw(
                "hospital.employee", //change to covid name
                "covid_testing_write",
                params,
                function (err, value) {
                  // if (err) {
                  //   return console.log(err);
                  // }
                  // console.log('Result: ', value);
                  res.send("Updated Covid Test details  !!");
                }
              );
            });
          }
        });
      });
    }
  });
});
// // Covid Vacination Api

//Save covid Vaccination Api
app.post("/api/saveCovidVaccination", (req, res) => {
  console.log("saveCovidvaccination req.query:::::");
  const form = formidable({ multiples: true });

  form.parse(req, async (err, fields, files) => {
    var date = new Date();
    console.log("fields ", fields);
    console.log("files ", files);

    if (files && files.photo_pdf0) {
      let imgLength = Object.keys(files).length;
      let extraFileArr = [];
      Object.keys(files).map(function (key, imgIndex) {
        var file = files[key];
        var fileName = file.originalFilename;
        var keyNameForS3 =
          "COVID_VACC_" + date.getTime() + "_" + sanitize(fileName, "");
        var url = "https://wss-files.s3.amazonaws.com/" + keyNameForS3;
        console.log("fileName ", fileName);

        fs.readFile(file.filepath, (err, data) => {
          if (err) throw err;
          // console.log("data is ",data)
          const params = {
            Bucket: "wss-files", // pass your bucket name
            Key: keyNameForS3, // file will be saved as testBucket/contacts.csv
            //ACL: 'public-read',
            ContentType: file.mimetype,
            ContentDisposition: "inline; filename=" + fileName,
            Body: data,
          };

          s3.putObject(params, function (s3Err, data) {
            if (s3Err) {
              res.send("Techinical Issue");
            } else {
              extraFileArr.push({
                name: keyNameForS3,
                company_id: 1,
                type: "binary",
                url: url,
                public: false,
                store_fname: "s3://wss-files/" + keyNameForS3,
                mimetype: file.mimetype,
                index_content: "application",
              });

              // console.log("before if extraFileArr :: ", extraFileArr);
              if (imgLength === imgIndex + 1) {
                // console.log("after if extraFileArr :: ", extraFileArr);
                odoo.connect(async (err) => {
                  if (err) {
                    res.send("Techinical Issue");
                  }
                  console.log("Save covid vaccination api ");
                  var isTrueSet = fields.exemption === "true";
                  var inParams = [];

                  inParams.push({
                    event_id: Number(fields.employee),
                    company: Number(fields.company),
                    child_ids: Number(fields.location),
                    employee: Number(fields.employee),
                    sex: fields.sex == "undefined" ? "Male" : fields.sex,
                    dob: fields.dob,
                    email: fields.email,
                    test_date: fields.test_date,
                    test_type: fields.test_type,
                    test_result: fields.testing_result
                      ? fields.testing_result
                      : "",
                    testing_status: "pending",
                    conducted_by: "ODOO-PORTAL",
                    exemption: isTrueSet,
                    exemption_type: fields.exemption_type,
                    exemption_comment: fields.exemption_comment,
                    dose : fields.dose,
                    extraFileArr : extraFileArr,
                    interestedInVaccination:fields.plan_vac_value,
                    expactedDate:fields.expactedDate?fields.expactedDate:moment(new Date()).format("YYYY-MM-DD"),
                    unvaccinated:(fields.unvaccinated === 'true'),
                    vaccinated : (fields.vaccinated === 'true')
                  });

                  var params = [];
                  params.push(inParams);

                  console.log("inParams", inParams);

                  await odoo.execute_kw(
                    // "hospital.employee",//change to covid name
                    // "covid_vaccination_write",
                    "covid.vaccination",
                    "vacc_create",
                    params,
                    function (err, value) {
                      // if (err) {
                      //   console.log("ERROR: ", err);
                      // } else {
                        console.log("SUCCESS: ", value);
                        res.send("Updated Covid Vaccination details  !!");
                      // }
                    }
                  );
                });
              }
            }
          });
        });
      });
    }
    else
    {
      odoo.connect(async (err) => {
        if (err) {
          res.send("Techinical Issue");
        }
        console.log("Save covid vaccination api ");
        var isTrueSet = (fields.exemption === 'true');
        var inParams = [];
        
        inParams.push({
          event_id: Number(fields.employee),
          company: Number(fields.company),
          child_ids: Number(fields.location),
          employee: Number(fields.employee),
          sex: fields.sex == 'undefined' ? 'Male' : fields.sex,
          dob: fields.dob,
          email: fields.email,
          test_date: fields.test_date,
          test_type: fields.test_type,
          test_result: fields.testing_result,
          testing_status: 'pending',
          conducted_by: 'ODOO-PORTAL',
          exemption: isTrueSet,
          exemption_type: fields.exemption_type,
          exemption_comment: fields.exemption_comment,
          dose : fields.dose,
          extraFileArr : [],
          interestedInVaccination:fields.plan_vac_value,
          expactedDate:fields.expactedDate?moment(fields.expactedDate).format("YYYY-MM-DD"):moment(new Date()).format("YYYY-MM-DD"),
          unvaccinated:(fields.unvaccinated === 'true'),
          vaccinated : (fields.vaccinated === 'true')
        });

        var params = [];
        params.push(inParams);

        console.log("inParams", inParams)

        await odoo.execute_kw(
          "covid.vaccination",
          "vacc_create",
          params,
          function (err, value) {
            // if (err) {
            //   res.send("Techinical Issue");
            // }
            //console.log('Result: ', value);
            res.send("Updated Covid Vaccination details  !!");
          }
        );

      })
    }
  });
});

// update covid vaccination

app.post("/api/updateCovidVaccination", (req, res) => {
  console.log("updateCovidVaccination req.query:::::");
  const form = formidable({ multiples: true });

  form.parse(req, async (err, fields, files) => {
    var date = new Date();
    console.log("fields ", fields);
    console.log("files ", files);
    if (files && files.photo_pdf0) {
      let imgLength = Object.keys(files).length;
      let extraFileArr = [];
      Object.keys(files).map(function (key, imgIndex) {
        var file = files[key];
        var fileName = file.originalFilename;

        var keyNameForS3 =
          "COVID_VACC_" + date.getTime() + "_" + sanitize(fileName, "");
        var url = "https://wss-files.s3.amazonaws.com/" + keyNameForS3;
        console.log("fileName ", fileName);

        fs.readFile(file.filepath, (err, data) => {
          if (err) throw err;
          // console.log("data is ",data)
          const params = {
            Bucket: "wss-files", // pass your bucket name
            Key: keyNameForS3, // file will be saved as testBucket/contacts.csv
            //ACL: 'public-read',
            ContentType: file.mimetype,
            ContentDisposition: "inline; filename=" + fileName,
            Body: data,
          };

          s3.putObject(params, function (s3Err, data) {
            if (s3Err) {
              res.send("Techinical Issue");
            } else {
              extraFileArr.push({
                name: keyNameForS3,
                company_id: 1,
                type: "binary",
                url: url,
                public: false,
                store_fname: "s3://wss-files/" + keyNameForS3,
                mimetype: file.mimetype,
                index_content: "application",
              });

              if (imgLength === imgIndex + 1) {
                odoo.connect(async (err) => {
                  if (err) {
                    res.send("Techinical Issue");
                  }
                  console.log("Save covid vaccination api ");
                  var isTrueSet = fields.exemption === "true";
                  var inParams = [];
                  inParams.push([]);

                  inParams.push({
                    event_id: Number(fields.employee),
                    company: Number(fields.company),
                    child_ids: Number(fields.location),
                    employee: Number(fields.employee),
                    sex: fields.sex == "undefined" ? "Male" : fields.sex,
                    dob: fields.dob,
                    email: fields.emailN,
                    test_date: fields.test_date,
                    test_type: fields.test_type,
                    test_result: fields.testing_result,
                    testing_status: "pending",
                    conducted_by: "ODOO-PORTAL",
                    exemption: isTrueSet,
                    exemption_type: fields.exemption_type,
                    exemption_comment: fields.exemption_comment,
                    dose: fields.dose,
                    extraFileArr: extraFileArr,
                    id: fields.id,
                    interestedInVaccination:fields.plan_vac_value,
                    expactedDate:fields.expactedDate?fields.expactedDate:moment(new Date()).format("YYYY-MM-DD"),
                    unvaccinated:(fields.unvaccinated === 'true'),
                    vaccinated : (fields.vaccinated === 'true')
                  });

                  var params = [];
                  params.push(inParams);

                  console.log("inParams", inParams);

                  await odoo.execute_kw(
                    // "hospital.employee",//change to covid name
                    // "covid_vaccination_write",
                    "covid.vaccination",
                    "vaccination_write",
                    params,
                    function (err, value) {
                      // if (err) {
                      //   res.send("Techinical Issue");
                      // }
                      //console.log('Result: ', value);
                      res.send("Updated Covid Vaccination details  !!");
                    }
                  );
                });
              }
            }
          });
        });
      });
    } else {
      odoo.connect(async (err) => {
        if (err) {
          res.send("Techinical Issue");
        }
        console.log("Save covid vaccination api ");
        var isTrueSet = fields.exemption === "true";
        var inParams = [];
        inParams.push([]);

        inParams.push({
          event_id: Number(fields.employee),
          company: Number(fields.company),
          child_ids: Number(fields.location),
          employee: Number(fields.employee),
          sex: fields.sex == "undefined" ? "Male" : fields.sex,
          dob: fields.dob,
          email: fields.emailN,
          test_date: fields.test_date,
          test_type: fields.test_type,
          test_result: fields.testing_result,
          testing_status: "pending",
          conducted_by: "ODOO-PORTAL",
          exemption: isTrueSet,
          exemption_type: fields.exemption_type,
          exemption_comment: fields.exemption_comment,
          dose: fields.dose,
          extraFileArr: [],
          id: fields.id,
          interestedInVaccination:fields.plan_vac_value,
          expactedDate:fields.expactedDate?moment(fields.expactedDate).format("YYYY-MM-DD"):moment(new Date()).format("YYYY-MM-DD"),
          unvaccinated:(fields.unvaccinated === 'true'),
          vaccinated : (fields.vaccinated === 'true')
        });

        var params = [];
        params.push(inParams);

        console.log("inParams", inParams);

        await odoo.execute_kw(
          // "hospital.employee",//change to covid name
          // "covid_vaccination_write",
          "covid.vaccination",
          "vaccination_write",
          params,
          function (err, value) {
            // if (err) {
            //   res.send("Techinical Issue");
            // }
            //console.log('Result: ', value);
            res.send("Updated Covid Vaccination details  !!");
          }
        );
      });
    }
  });
});

// Download Covid Testing Certificate

app.get("/api/downloadTestingCertificate", (req, res) => {
  console.log("saveCovidTesting Certificate req.query:::::", req);
  var bucket_name = req.query.attachment_url
    .split(".s3")[0]
    .split("https://")[1];
  var fileName = req.query.attachment_url.split(".com/").pop().split("?")[0];
  console.log("filename Body :", fileName);
  var params = { Bucket: bucket_name, Key: fileName };
  s3.getSignedUrl("getObject", params, function (err, url) {
    console.log("The URL is", url);
    res.send(url);
  });
});

//Download Covid Vaccine Certificate

app.get("/api/downloadVaccineCertificate", async (req, res) => {
  console.log(
    "saveVaccination Certificate req.query:::::",
    req.query.attachment_detail
  );
  if (Array.isArray(req.query.attachment_detail)) {
    let ids = req.query.attachment_detail.join(",");
    const result = await pool.query(
      "SELECT * from ir_attachment where id IN (" + ids + ")"
    );
    console.log("training courses:::", result.rows);
    if (result.rows && result.rows.length > 0) {
      let imageUrls = [];
      result.rows.map((imgData, index) => {
        console.log("imgData :", fileName);
        var bucket_name = imgData.url.split(".s3")[0].split("https://")[1];
        var fileName = imgData.name;
        console.log("filename Body :", fileName);
        var params = { Bucket: bucket_name, Key: fileName };
        console.log("params :: ", params);
        s3.getSignedUrl("getObject", params, function (err, url) {
          console.log("The URL is", url);
          params["fileType"] = imgData.mimetype;
          imageUrls.push({ ...params, url });
          if (result.rows.length === index + 1) {
            console.log("imageUrls :: ", imageUrls);
            res.send(imageUrls);
          }
        });
      });
    }
  } else {
    var bucket_name = req.query.attachment_detail
      .split(".s3")[0]
      .split("https://")[1];
    var fileName = req.query.attachment_detail
      .split(".com/")
      .pop()
      .split("?")[0];
    console.log("filename Body :", fileName);
    var params = { Bucket: bucket_name, Key: fileName };
    s3.getSignedUrl("getObject", params, function (err, url) {
      console.log("The URL is", url);
      res.send(url);
    });
  }
});

// API TO VERIFY LOGIN EMAIL CREDENTIALS
app.get("/api/EmployeeInfo", (req, res) => {
  odoo.connect(function (err, email) {
    if (err) {
      console.log("first error", err);
    }
    //   console.log("Connected to Odoo server Cust EmployeeInfo", req.query.user);
    var inParams = [];
    inParams.push([
      [
        "email",
        "=",
        req.query.email,
        "Mobile",
        "=",
        req.query.Mobile,
        "isEmail",
        "=",
        req.query.isEmail,
      ],
    ]);
    console.log("myemail is");
    inParams.push([]);
    // inParams.push(0);  //offset
    // inParams.push(1);  //Limit
    var params = [];
    params.push(inParams);

    odoo.execute_kw(
      "hospital.employee",
      "search",
      params,
      function (err, value) {
        if (err) {
          console.log("Error detected", err);
        }
        console.log("res", value);
        var inParams = [];
        inParams.push(value); //ids
        var params = [];
        params.push(inParams);
        odoo.execute_kw(
          "hospital.employee",
          "read",
          params,
          function (err2, value2) {
            if (err2) {
              return console.log(err2);
            }
            console.log("email: ", value2);
            res.send(value2);
          }
        );
      }
    );
  });
});

app.get("/api/EmployeeInfop", (req, res) => {
  odoo.connect(function (err, Mobile) {
    if (err) {
      console.log("first error", err);
    }
    //   console.log("Connected to Odoo server Cust EmployeeInfo", req.query.user);
    var inParams = [];
    inParams.push([["Mobile", "=", req.query]]);
    console.log("myphone number is");
    inParams.push([]);
    // inParams.push(0);  //offset
    // inParams.push(1);  //Limit
    var params = [];
    params.push(inParams);

    odoo.execute_kw(
      "hospital.employee",
      "search",
      params,
      function (err, value) {
        if (err) {
          console.log("Error detected", err);
        }
        console.log("res", value);
        var inParams = [];
        inParams.push(value); //ids
        var params = [];
        params.push(inParams);
        odoo.execute_kw(
          "hospital.employee",
          "read",
          params,
          function (err2, value2) {
            if (err2) {
              return console.log(err2);
            }
            console.log("phone: ", value2);
            res.send(value2);
          }
        );
      }
    );
  });
});

app.get("/api/EmployeeInfoPhysical", (req, res) => {
  console.log("req--EmployeeInfoPhysical", req.query);
  //console.log("req.session",req.session);


  odoo.connect(function (err, uid) {
    if (err) {
      // return console.log(err);
      console.log(err)
      res.send({ error: err })
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
        res.send({ error: err })
        return;
      }
      res.send(value)
      
    });
  });
});
app.get("/api/saveFormIntake", (req, res) => {
  

  odoo.connect(function (err) {
    if (err) {
      // return console.log(err);
      console.log(err)
      res.send({ error: err })
      return;
    }
    console.log("Connected to Odoo server saveFormIntake", req.query);

    var inParams = [];
    inParams.push([]);
    inParams.push({

      patientFirstName: req.query.patientFirstName,
      patientMiddleName: req.query.patientMiddleName,
      patientLastName: req.query.patientLastName,
      DateofBirth: req.query.DateofBirth,
      gender: req.query.gender,
      id: Number(req.query.id),
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
        res.send({ error: err })
        return;
      }
      //console.log('Result: ', value);
      try {
        res.send("Created Intake Form!!")
      } catch (e) {
        console.log("error", e)
      }
    });

  });
});
app.get("/api/saveFormPhysical", (req, res) => {
  console.log("data::")
  

  odoo.connect(function (err) {
    if (err) {
      // return console.log(err);
      console.log(err)
      res.send({ error: err })
      return;
    }
    console.log("Connected to Odoo server saveFormPhysical", req.query);
    let mediArr = [];
    if (req.query.medicationArrOne.length > 0) {
      req.query.medicationArrOne.map((dat) => {
        mediArr.push(JSON.parse(dat))
      })
    }
    console.log("mediArr::", mediArr)
    let alergyArr = [];
    if (req.query.allergyArrOne.length > 0) {
      req.query.allergyArrOne.map((dat) => {
        alergyArr.push(JSON.parse(dat))
      })
    }
    console.log("alergyArr::", alergyArr)
    var inParams = [];
    inParams.push([]);
    inParams.push({

      // 'company': Number(req.query.compNameN),
      id: Number(req.query.empId),
      emp_name: req.query.employerName ? req.query.employerName : null,
      name: req.query.Name ? req.query.Name : null,
      date: req.query.Date ? req.query.Date : null,
      ila_no: req.query.ILAWorkNumber ? req.query.ILAWorkNumber : null,
      telephone_one: req.query.Telephone ? req.query.Telephone : null,
      emr_cont: req.query.EmergencyContact ? req.query.EmergencyContact : null,
      telephone_two: req.query.Telephone2 ? req.query.Telephone2 : null,
      relation: req.query.RelationEmergerncyContact ? req.query.RelationEmergerncyContact : null,

      medi_array: mediArr,
      allergy_array: alergyArr,
      // dose:JSON.parse(req.query.medicationArrOne[0]).dose,
      // route:JSON.parse(req.query.medicationArrOne[0]).route,
      // frequency:JSON.parse(req.query.medicationArrOne[0]).frequency,
      // reason:JSON.parse(req.query.medicationArrOne[0]).reason,
      // how_long:JSON.parse(req.query.medicationArrOne[0]).how_long,
      // prescribed:JSON.parse(req.query.medicationArrOne[0]).prescribed,

      // allergies:JSON.parse(req.query.allergyArrOne[0]).allergies,
      // reaction_type:JSON.parse(req.query.allergyArrOne[0]).reaction_type,

      tetanus_date: req.query.DateofLastTetanusVaccination ? req.query.DateofLastTetanusVaccination : null,
      // JSON.parse(req.query.TrackVisits[0])
      illness: JSON.parse(req.query.PastMedHistory[0]).prior_illness.reason ? JSON.parse(req.query.PastMedHistory[0]).prior_illness.reason : null,
      illness_date: JSON.parse(req.query.PastMedHistory[0]).prior_illness.date ? JSON.parse(req.query.PastMedHistory[0]).prior_illness.date : null,
      injury: JSON.parse(req.query.PastMedHistory[0]).injury.reason ? JSON.parse(req.query.PastMedHistory[0]).injury.reason : null,
      injury_date: JSON.parse(req.query.PastMedHistory[0]).injury.date ? JSON.parse(req.query.PastMedHistory[0]).injury.date : null,
      hospitalization: JSON.parse(req.query.PastMedHistory[0]).hospitalization.reason ? JSON.parse(req.query.PastMedHistory[0]).hospitalization.reason : null,
      hospitalization_date: JSON.parse(req.query.PastMedHistory[0]).hospitalization.date ? JSON.parse(req.query.PastMedHistory[0]).hospitalization.date : null,
      surgery: JSON.parse(req.query.PastMedHistory[0]).surgery.reason ? JSON.parse(req.query.PastMedHistory[0]).surgery.reason : null,
      surgery_date: JSON.parse(req.query.PastMedHistory[0]).surgery.date ? JSON.parse(req.query.PastMedHistory[0]).surgery.date : null,
      trauma: JSON.parse(req.query.PastMedHistory[0]).trauma.reason ? JSON.parse(req.query.PastMedHistory[0]).trauma.reason : null,
      trauma_date: JSON.parse(req.query.PastMedHistory[0]).trauma.date ? JSON.parse(req.query.PastMedHistory[0]).trauma.date : null,

      illness_injury: JSON.parse(req.query.healthHistory[0]).injury.option ? JSON.parse(req.query.healthHistory[0]).injury.option : null,
      illness_injury_des: JSON.parse(req.query.healthHistory[0]).injury.desc ? JSON.parse(req.query.healthHistory[0]).injury.desc : null,
      head_brain: JSON.parse(req.query.healthHistory[0]).head_brain_injury ? JSON.parse(req.query.healthHistory[0]).head_brain_injury : null,
      Seizures_epilepsy: JSON.parse(req.query.healthHistory[0]).Seizures ? JSON.parse(req.query.healthHistory[0]).Seizures : null,
      Medication_epilepsy: JSON.parse(req.query.healthHistory[0]).Medication_for_seizures_epilepsy ? JSON.parse(req.query.healthHistory[0]).Medication_for_seizures_epilepsy : null,
      Eye_disorder: JSON.parse(req.query.healthHistory[0]).Eye_disorders_or_impaired_vision.option ? JSON.parse(req.query.healthHistory[0]).Eye_disorders_or_impaired_vision.option : null,
      Eye_disorder_des: JSON.parse(req.query.healthHistory[0]).Eye_disorders_or_impaired_vision.desc ? JSON.parse(req.query.healthHistory[0]).Eye_disorders_or_impaired_vision.desc : null,
      Ear_disorders: JSON.parse(req.query.healthHistory[0]).Ear_disorders_loss_of_hearing ? JSON.parse(req.query.healthHistory[0]).Ear_disorders_loss_of_hearing : null,
      Heart_disease: JSON.parse(req.query.healthHistory[0]).Heart_disease ? JSON.parse(req.query.healthHistory[0]).Heart_disease : null,
      Medication_heart: JSON.parse(req.query.healthHistory[0]).Medication_for_heart_condition ? JSON.parse(req.query.healthHistory[0]).Medication_for_heart_condition : null,
      Heart_surgery: JSON.parse(req.query.healthHistory[0]).Heart_surgery ? JSON.parse(req.query.healthHistory[0]).Heart_surgery : null,
      High_blood: JSON.parse(req.query.healthHistory[0]).High_blood_pressure ? JSON.parse(req.query.healthHistory[0]).High_blood_pressure : null,
      Medication_high: JSON.parse(req.query.healthHistory[0]).Medication_for_high_blood_pressure ? JSON.parse(req.query.healthHistory[0]).Medication_for_high_blood_pressure : null,
      Muscular_disease: JSON.parse(req.query.healthHistory[0]).Muscular_disease ? JSON.parse(req.query.healthHistory[0]).Muscular_disease : null,
      Shortness_breath: JSON.parse(req.query.healthHistory[0]).Shortness_of_breath ? JSON.parse(req.query.healthHistory[0]).Shortness_of_breath : null,
      Lung_disease: JSON.parse(req.query.healthHistory[0]).Lung_disease_emphysema ? JSON.parse(req.query.healthHistory[0]).Lung_disease_emphysema : null,
      Kidney_disease: JSON.parse(req.query.healthHistory[0]).Kidney_disease_dialysis ? JSON.parse(req.query.healthHistory[0]).Kidney_disease_dialysis : null,
      Liver_disease: JSON.parse(req.query.healthHistory[0]).Liver_disease ? JSON.parse(req.query.healthHistory[0]).Liver_disease : null,
      Digestive_problems: JSON.parse(req.query.healthHistory[0]).Digestive_problems ? JSON.parse(req.query.healthHistory[0]).Digestive_problems : null,
      Diabetes_blood: JSON.parse(req.query.healthHistory[0]).Diabetes_or_elevated_blood_sugar.option ? JSON.parse(req.query.healthHistory[0]).Diabetes_or_elevated_blood_sugar.option : null,
      Diabetes_blood_cont: JSON.parse(req.query.healthHistory[0]).Diabetes_or_elevated_blood_sugar.desc ? JSON.parse(req.query.healthHistory[0]).Diabetes_or_elevated_blood_sugar.desc : null,
      Nervous_psychiatric: JSON.parse(req.query.healthHistory[0]).Nervous_or_psychiatric_disorder ? JSON.parse(req.query.healthHistory[0]).Nervous_or_psychiatric_disorder : null,
      Medication_nervous: JSON.parse(req.query.healthHistory[0]).Medication_for_nervous_or_psychiatric_disorder ? JSON.parse(req.query.healthHistory[0]).Medication_for_nervous_or_psychiatric_disorder : null,
      Loss_altered: JSON.parse(req.query.healthHistory[0]).Loss_of_or_altered_consciousness ? JSON.parse(req.query.healthHistory[0]).Loss_of_or_altered_consciousness : null,
      Fainting_dizziness: JSON.parse(req.query.healthHistory[0]).Fainting_dizziness ? JSON.parse(req.query.healthHistory[0]).Fainting_dizziness : null,
      Sleep_disorders: JSON.parse(req.query.healthHistory[0]).Sleep_disorders_pauses_in_breathing ? JSON.parse(req.query.healthHistory[0]).Sleep_disorders_pauses_in_breathing : null,
      Stroke_paralysis: JSON.parse(req.query.healthHistory[0]).Stroke_or_paralysis ? JSON.parse(req.query.healthHistory[0]).Stroke_or_paralysis : null,
      Missing_impaired: JSON.parse(req.query.healthHistory[0]).Missing_or_impaired_hand_arm_foot ? JSON.parse(req.query.healthHistory[0]).Missing_or_impaired_hand_arm_foot : null,
      Spinal_injury: JSON.parse(req.query.healthHistory[0]).Spinal_injury_or_disease ? JSON.parse(req.query.healthHistory[0]).Spinal_injury_or_disease : null,
      Chronic_low: JSON.parse(req.query.healthHistory[0]).Chronic_low_back_pain ? JSON.parse(req.query.healthHistory[0]).Chronic_low_back_pain : null,
      Regular_alcohol: JSON.parse(req.query.healthHistory[0]).Regular_frequent_alcohol_use ? JSON.parse(req.query.healthHistory[0]).Regular_frequent_alcohol_use : null,
      Narcotic_drug: JSON.parse(req.query.healthHistory[0]).Narcotic_or_habit_forming_drug_use ? JSON.parse(req.query.healthHistory[0]).Narcotic_or_habit_forming_drug_use : null,
      health_history_res: JSON.parse(req.query.healthHistory[0]).diagnosis ? JSON.parse(req.query.healthHistory[0]).diagnosis : null,

      worker_sign_date:req.query.SignDate?req.query.SignDate:null
      // EmergencyContact: req.query.EmergencyContact,
    });
    console.log("inParams:::", inParams)
    var params = [];
    params.push(inParams);

    console.log("params saveFormPhysical::::", params);

    odoo.execute_kw('hospital.employee', 'physical_write', params, function (err, value) {
      if (err) {
        console.log(err)
        res.send({ error: err })
        return;
      }
      res.send("Created Physical Form!!")
     
    });
  });
});

async function wrapedSendMail(mailOptions) {
  console.log(
    "REGULAR complete email",
    JSON.stringify(mailOptions),
    JSON.stringify(config.transportOptions)
  );
  return new Promise((resolve, reject) => {
    transport.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log("error is " + error);
        resolve(error); // or use reject(false) but then you will have to handle errors
      } else {
        console.log("Email sent: " + info.response);
        resolve(info);
      }
    });
  });
}

app.listen(3004, () =>
  console.log("Express server is running on localhost:3004")
);
