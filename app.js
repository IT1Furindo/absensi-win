// require dotenv
require("dotenv").config();
const express = require("express");
const ADODB = require("node-adodb");
const app = express();
const port = 3000;
const fs = require("fs");
const cors = require("cors");
const axios = require("axios");
const serverURL = process.env.HOST_ADDRESS;

app.use(cors());
// Enable JSON use
app.use(express.json());

// Connect to the .mdb file
const connection = ADODB.open(
  "Provider=Microsoft.Jet.OLEDB.4.0;Data Source=att2000.mdb;"
);

const mdbPath = "./att2000.mdb";
fs.watch(mdbPath, async (eventType, filename) => {
  // console.log(`Event type is: ${eventType}`);
  // console.log(`Filename provided: ${filename}`);
  if (eventType === "change") {
    console.log(`${filename} has been changed.`);

    try {
      // Lakukan request ke Mac Anda menggunakan axios
      const { data } = await axios({
        method: "get",
        url: `${serverURL}/monitor`,
      });

      // Log respons dari Mac jika perlu
      console.log("Sudah di hit dari Mac");
    } catch (error) {
      // Tangani error yang mungkin terjadi selama request HTTP
      console.error("Error on sending request to Mac:", error.message);
    }
  }
});

app.get("/", (req, res) => {
  res.send({
    status: "Terhubung",
    apiList: [
      {
        url: "/absen",
        method: "GET",
        description: "Mengambil semua data absen",
      },
      { url: "/absen", method: "POST", description: "Menambah data absen" },
      {
        url: "/absen/:id",
        method: "PUT",
        description: "Mengubah data absen berdasarkan USERID dan CHECKTIME",
      },
      {
        url: "/absen/:id",
        method: "DELETE",
        description: "Menghapus data absen berdasarkan USERID dan CHECKTIME",
      },
      {
        url: "/employee",
        method: "GET",
        description: "Mengambil semua data karyawan",
      },
      {
        url: "/employee?id=USERID&name=name",
        method: "GET",
        description: "Mengambil data karyawan berdasarkan USERID dan name",
      },
    ],
  });
});

app.get("/fetch", async (req, res) => {
  try {
    const { last_fetch } = req.query;

    let query = `
      SELECT c.USERID, c.CHECKTIME, c.CHECKTYPE, c.VERIFYCODE, c.SENSORID, c.Memoinfo, c.WorkCode, c.sn, c.UserExtFmt, c.mask_flag, c.temperature, u.name, u.Badgenumber
      FROM CHECKINOUT AS c
      INNER JOIN USERINFO AS u ON c.USERID = u.USERID
    `;

    if (last_fetch) {
      const newDate = new Date(new Date(+last_fetch)).toLocaleString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Asia/Jakarta",
        hour12: true,
        hourCycle: "h12",
      });

      const rawDate = newDate.split(",");
      const date = rawDate[0].split("/");
      const time = rawDate[1].replace(/\./g, ":").trim();
      const fixDate = `${date[1]}/${date[0]}/${date[2]} ${time}`;
      // Append WHERE clause to the query
      query += ` WHERE c.CHECKTIME >= #${fixDate}#`;
    }

    // Append ORDER BY clause to the query
    query += ` ORDER BY c.CHECKTIME ASC`;
    const data = await connection.query(query);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
});

// READ - Get data
app.get("/absen", async (req, res) => {
  try {
    const data = await connection.query("SELECT * FROM CHECKINOUT");
    res.json(data);
  } catch (error) {
    res.status(500).send(error);
  }
});

app.get("/employee", async (req, res) => {
  try {
    // Destructure the query parameters
    const { id, name } = req.query;

    // Validate the presence of both parameters
    if ((id && !name) || (!id && name)) {
      return res
        .status(400)
        .send("Both USERID and name parameters must be provided.");
    }

    // Initialize the base query
    let query = "SELECT USERID, name, Badgenumber FROM USERINFO";

    // Check if both parameters are provided
    let parametersProvided = id && name;

    // Append conditions if both parameters are provided
    if (parametersProvided) {
      query += ` WHERE USERID = ${id} AND name = '${name}'`;
    }

    // Execute the query
    const data = await connection.query(query);

    // Check if any data was returned when parameters were provided
    if (parametersProvided && data.length === 0) {
      return res.status(404).send("User Not Found");
    }

    res.json(data);
  } catch (error) {
    console.log(error); // More detailed error logging
    res.status(500).send("An error occurred while fetching data.");
  }
});

// CREATE - Add a new item
app.post("/absen", async (req, res) => {
  // Destructure the required fields from the request body
  const {
    USERID,
    CHECKTIME,
    CHECKTYPE,
    VERIFYCODE,
    SENSORID,
    Memoinfo,
    WorkCode,
    sn,
    UserExtFmt,
    mask_flag,
    temperature,
  } = req.body;

  // Construct the SQL query. Make sure to match the column names and values with your table's schema
  const query = `
    INSERT INTO CHECKINOUT 
    (USERID, CHECKTIME, CHECKTYPE, VERIFYCODE, SENSORID, Memoinfo, WorkCode, sn, UserExtFmt, mask_flag, temperature)
    VALUES (${USERID}, #${CHECKTIME}#, '${CHECKTYPE}', ${VERIFYCODE}, '${SENSORID}', '${Memoinfo}', '${WorkCode}', '${sn}', ${UserExtFmt}, ${mask_flag}, ${temperature})
  `;

  try {
    const data = await connection.execute(query);
    res.status(201).send("Record created successfully");
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
});

// UPDATE - Update an item
app.put("/absen/:id", async (req, res) => {
  const { id } = req.params; // USERID
  const {
    CHECKTIME,
    newCHECKTIME,
    CHECKTYPE,
    VERIFYCODE,
    SENSORID,
    Memoinfo,
    WorkCode,
    sn,
    UserExtFmt,
    mask_flag,
    temperature,
  } = req.body;

  const query = `
    UPDATE CHECKINOUT 
    SET 
      CHECKTIME = #${newCHECKTIME}#, 
      CHECKTYPE = '${CHECKTYPE}', 
      VERIFYCODE = ${VERIFYCODE}, 
      SENSORID = '${SENSORID}', 
      Memoinfo = '${Memoinfo}', 
      WorkCode = '${WorkCode}', 
      sn = '${sn}', 
      UserExtFmt = ${UserExtFmt}, 
      mask_flag = ${mask_flag}, 
      temperature = ${temperature}
    WHERE USERID = ${id} AND CHECKTIME = #${CHECKTIME}#
  `;

  try {
    await connection.execute(query);
    res.send("Record updated successfully");
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
});

// DELETE - Delete an item
app.delete("/absen/:id", async (req, res) => {
  const { id } = req.params; // USERID
  const { CHECKTIME } = req.body; // Assume CHECKTIME is provided in the body

  const query = `DELETE FROM CHECKINOUT WHERE USERID = ${id} AND CHECKTIME = #${CHECKTIME}#`;

  try {
    await connection.execute(query);
    res.send("Record deleted successfully");
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
});

app.listen(port, "0.0.0.0", () =>
  console.log(`Server running on port ${port}`)
);
