const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const PORT = 3000;


// =========================================================
// MIDDLEWARE
// =========================================================

app.use(express.json());


// =========================================================
// DATABASE
// =========================================================

const dbPath = path.join(
  __dirname,
  "mappingsite.db"
);

const db = new Database(dbPath);

console.log("SQLite database connected.");


// Better SQLite performance
db.pragma("journal_mode = WAL");


// =========================================================
// CREATE FEEDBACK TABLE IF NEEDED
// =========================================================
//
// IMPORTANT:
// Your existing feedback table uses:
// category, page, status
//
// We keep that structure.
// =========================================================

db.prepare(`
  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    category TEXT,
    message TEXT NOT NULL,
    page TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'new'
  )
`).run();


// =========================================================
// SERVE WEBSITE
// =========================================================

app.use(
  express.static(__dirname)
);


// =========================================================
// HELPER — VALIDATE CLINIC
// =========================================================

function validateClinic(data) {

  const errors = [];


  // Clinic name
  if (
    !data.clinic_name ||
    typeof data.clinic_name !== "string" ||
    !data.clinic_name.trim()
  ) {

    errors.push(
      "Clinic name is required."
    );

  }


  // Clinic type
  if (
    !data.clinic_type ||
    typeof data.clinic_type !== "string" ||
    !data.clinic_type.trim()
  ) {

    errors.push(
      "Clinic type is required."
    );

  }


  // Address
  if (
    !data.address ||
    typeof data.address !== "string" ||
    !data.address.trim()
  ) {

    errors.push(
      "Address is required."
    );

  }


  // Latitude
  if (
    data.latitude !== "" &&
    data.latitude !== null &&
    data.latitude !== undefined
  ) {

    const latitude =
      Number(data.latitude);


    if (
      Number.isNaN(latitude) ||
      latitude < -90 ||
      latitude > 90
    ) {

      errors.push(
        "Latitude must be between -90 and 90."
      );

    }

  }


  // Longitude
  if (
    data.longitude !== "" &&
    data.longitude !== null &&
    data.longitude !== undefined
  ) {

    const longitude =
      Number(data.longitude);


    if (
      Number.isNaN(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {

      errors.push(
        "Longitude must be between -180 and 180."
      );

    }

  }


  // Website
  if (
    data.website &&
    typeof data.website === "string"
  ) {

    try {

      new URL(data.website);

    } catch {

      errors.push(
        "Website must be a valid URL."
      );

    }

  }


  return errors;

}


// =========================================================
// GET ALL CLINICS
// =========================================================

app.get(
  "/api/admin/clinics",
  (req, res) => {

    try {

      const clinics =
        db
          .prepare(`
            SELECT *
            FROM clinics
            ORDER BY id DESC
          `)
          .all();


      res.json(clinics);


    } catch (error) {

      console.error(
        "GET /api/admin/clinics error:",
        error
      );


      res.status(500).json({
        error:
          "Failed to load clinics."
      });

    }

  }
);


// =========================================================
// GET ONE CLINIC
// =========================================================

app.get(
  "/api/admin/clinics/:id",
  (req, res) => {

    try {

      const id =
        Number(req.params.id);


      if (!Number.isInteger(id)) {

        return res.status(400).json({
          error:
            "Invalid clinic ID."
        });

      }


      const clinic =
        db
          .prepare(`
            SELECT *
            FROM clinics
            WHERE id = ?
          `)
          .get(id);


      if (!clinic) {

        return res.status(404).json({
          error:
            "Clinic not found."
        });

      }


      res.json(clinic);


    } catch (error) {

      console.error(
        "GET clinic error:",
        error
      );


      res.status(500).json({
        error:
          "Failed to load clinic."
      });

    }

  }
);


// =========================================================
// ADD CLINIC
// =========================================================

app.post(
  "/api/admin/clinics",
  (req, res) => {

    try {

      const data =
        req.body;


      const errors =
        validateClinic(data);


      if (errors.length > 0) {

        return res.status(400).json({
          error:
            "Validation failed.",

          details:
            errors

        });

      }


      const latitude =
        data.latitude === "" ||
        data.latitude === null ||
        data.latitude === undefined
          ? null
          : Number(data.latitude);


      const longitude =
        data.longitude === "" ||
        data.longitude === null ||
        data.longitude === undefined
          ? null
          : Number(data.longitude);


      const result =
        db
          .prepare(`
            INSERT INTO clinics (

              clinic_name,
              clinic_type,
              address,
              old_address,
              ward,
              prov,
              latitude,
              longitude,
              pricing,
              phone,
              website,
              operating_hours,
              license_number,
              license_issue_date,
              description,
              target_groups

            )

            VALUES (

              @clinic_name,
              @clinic_type,
              @address,
              @old_address,
              @ward,
              @prov,
              @latitude,
              @longitude,
              @pricing,
              @phone,
              @website,
              @operating_hours,
              @license_number,
              @license_issue_date,
              @description,
              @target_groups

            )
          `)
          .run({

            clinic_name:
              data.clinic_name.trim(),

            clinic_type:
              data.clinic_type.trim(),

            address:
              data.address.trim(),

            old_address:
              data.old_address?.trim() || "",

            ward:
              data.ward?.trim() || "",

            prov:
              data.prov?.trim() || "",

            latitude,

            longitude,

            pricing:
              data.pricing?.trim() || "",

            phone:
              data.phone?.trim() || "",

            website:
              data.website?.trim() || "",

            operating_hours:
              data.operating_hours?.trim() || "",

            license_number:
              data.license_number?.trim() || "",

            license_issue_date:
              data.license_issue_date || "",

            description:
              data.description?.trim() || "",

            target_groups:
              data.target_groups?.trim() || ""

          });


      const newClinic =
        db
          .prepare(`
            SELECT *
            FROM clinics
            WHERE id = ?
          `)
          .get(
            result.lastInsertRowid
          );


      res.status(201).json({

        message:
          "Clinic added successfully.",

        clinic:
          newClinic

      });


    } catch (error) {

      console.error(
        "POST /api/admin/clinics error:",
        error
      );


      res.status(500).json({
        error:
          "Failed to add clinic."
      });

    }

  }
);


// =========================================================
// UPDATE CLINIC
// =========================================================

app.put(
  "/api/admin/clinics/:id",
  (req, res) => {

    try {

      const id =
        Number(req.params.id);


      if (!Number.isInteger(id)) {

        return res.status(400).json({
          error:
            "Invalid clinic ID."
        });

      }


      const existing =
        db
          .prepare(`
            SELECT *
            FROM clinics
            WHERE id = ?
          `)
          .get(id);


      if (!existing) {

        return res.status(404).json({
          error:
            "Clinic not found."
        });

      }


      const data =
        req.body;


      const errors =
        validateClinic(data);


      if (errors.length > 0) {

        return res.status(400).json({
          error:
            "Validation failed.",

          details:
            errors

        });

      }


      const latitude =
        data.latitude === "" ||
        data.latitude === null ||
        data.latitude === undefined
          ? null
          : Number(data.latitude);


      const longitude =
        data.longitude === "" ||
        data.longitude === null ||
        data.longitude === undefined
          ? null
          : Number(data.longitude);


      db
        .prepare(`
          UPDATE clinics

          SET

            clinic_name =
              @clinic_name,

            clinic_type =
              @clinic_type,

            address =
              @address,

            old_address =
              @old_address,

            ward =
              @ward,

            prov =
              @prov,

            latitude =
              @latitude,

            longitude =
              @longitude,

            pricing =
              @pricing,

            phone =
              @phone,

            website =
              @website,

            operating_hours =
              @operating_hours,

            license_number =
              @license_number,

            license_issue_date =
              @license_issue_date,

            description =
              @description,

            target_groups =
              @target_groups

          WHERE id = @id
        `)
        .run({

          id,

          clinic_name:
            data.clinic_name.trim(),

          clinic_type:
            data.clinic_type.trim(),

          address:
            data.address.trim(),

          old_address:
            data.old_address?.trim() || "",

          ward:
            data.ward?.trim() || "",

          prov:
            data.prov?.trim() || "",

          latitude,

          longitude,

          pricing:
            data.pricing?.trim() || "",

          phone:
            data.phone?.trim() || "",

          website:
            data.website?.trim() || "",

          operating_hours:
            data.operating_hours?.trim() || "",

          license_number:
            data.license_number?.trim() || "",

          license_issue_date:
            data.license_issue_date || "",

          description:
            data.description?.trim() || "",

          target_groups:
            data.target_groups?.trim() || ""

        });


      const updatedClinic =
        db
          .prepare(`
            SELECT *
            FROM clinics
            WHERE id = ?
          `)
          .get(id);


      res.json({

        message:
          "Clinic updated successfully.",

        clinic:
          updatedClinic

      });


    } catch (error) {

      console.error(
        "PUT clinic error:",
        error
      );


      res.status(500).json({
        error:
          "Failed to update clinic."
      });

    }

  }
);


// =========================================================
// DELETE CLINIC
// =========================================================

app.delete(
  "/api/admin/clinics/:id",
  (req, res) => {

    try {

      const id =
        Number(req.params.id);


      if (!Number.isInteger(id)) {

        return res.status(400).json({
          error:
            "Invalid clinic ID."
        });

      }


      const result =
        db
          .prepare(`
            DELETE FROM clinics
            WHERE id = ?
          `)
          .run(id);


      if (result.changes === 0) {

        return res.status(404).json({
          error:
            "Clinic not found."
        });

      }


      res.json({
        message:
          "Clinic deleted successfully."
      });


    } catch (error) {

      console.error(
        "DELETE clinic error:",
        error
      );


      res.status(500).json({
        error:
          "Failed to delete clinic."
      });

    }

  }
);


// =========================================================
// SUBMIT USER FEEDBACK
// =========================================================
//
// Frontend sends:
// name
// email
// type
// message
//
// Database stores:
// category
// page
// status
// =========================================================

app.post(
  "/api/feedback",
  (req, res) => {

    try {

      const {
        name,
        email,
        type,
        message
      } = req.body;


      // -----------------------------
      // VALIDATION
      // -----------------------------

      if (
        !name ||
        typeof name !== "string" ||
        !name.trim()
      ) {

        return res.status(400).json({
          error:
            "Name is required."
        });

      }


      if (
        !type ||
        typeof type !== "string" ||
        !type.trim()
      ) {

        return res.status(400).json({
          error:
            "Feedback topic is required."
        });

      }


      if (
        !message ||
        typeof message !== "string" ||
        !message.trim()
      ) {

        return res.status(400).json({
          error:
            "Message is required."
        });

      }


      // -----------------------------
      // INSERT
      // -----------------------------

      const result =
        db
          .prepare(`
            INSERT INTO feedback (

              name,
              email,
              category,
              message,
              page

            )

            VALUES (

              @name,
              @email,
              @category,
              @message,
              @page

            )
          `)
          .run({

            name:
              name.trim(),

            email:
              typeof email === "string"
                ? email.trim()
                : "",

            category:
              type.trim(),

            message:
              message.trim(),

            page:
              req.headers.referer ||
              ""

          });


      res.status(201).json({

        success:
          true,

        message:
          "Feedback submitted successfully.",

        id:
          result.lastInsertRowid

      });


    } catch (error) {

      console.error(
        "POST /api/feedback error:",
        error
      );


      res.status(500).json({

        error:
          "Failed to save feedback."

      });

    }

  }
);


// =========================================================
// GET ALL FEEDBACK — ADMIN
// =========================================================

app.get(
  "/api/admin/feedback",
  (req, res) => {

    try {

      const feedback =
        db
          .prepare(`
            SELECT

              id,
              name,
              email,
              category,
              message,
              page,
              created_at,
              status

            FROM feedback

            ORDER BY id DESC
          `)
          .all();


      res.json(feedback);


    } catch (error) {

      console.error(
        "GET /api/admin/feedback error:",
        error
      );


      res.status(500).json({

        error:
          "Failed to load feedback."

      });

    }

  }
);


// =========================================================
// UPDATE FEEDBACK STATUS — ADMIN
// =========================================================

app.patch(
  "/api/admin/feedback/:id",
  (req, res) => {

    try {

      const id =
        Number(req.params.id);


      const {
        status
      } = req.body;


      const allowedStatuses = [
        "new",
        "reviewed",
        "resolved"
      ];


      if (
        !Number.isInteger(id)
      ) {

        return res.status(400).json({
          error:
            "Invalid feedback ID."
        });

      }


      if (
        !allowedStatuses.includes(
          status
        )
      ) {

        return res.status(400).json({
          error:
            "Invalid feedback status."
        });

      }


      const result =
        db
          .prepare(`
            UPDATE feedback

            SET status = ?

            WHERE id = ?
          `)
          .run(
            status,
            id
          );


      if (
        result.changes === 0
      ) {

        return res.status(404).json({
          error:
            "Feedback not found."
        });

      }


      const updated =
        db
          .prepare(`
            SELECT *
            FROM feedback
            WHERE id = ?
          `)
          .get(id);


      res.json({

        message:
          "Feedback status updated.",

        feedback:
          updated

      });


    } catch (error) {

      console.error(
        "PATCH feedback error:",
        error
      );


      res.status(500).json({

        error:
          "Failed to update feedback."

      });

    }

  }
);


// =========================================================
// DELETE FEEDBACK — ADMIN
// =========================================================

app.delete(
  "/api/admin/feedback/:id",
  (req, res) => {

    try {

      const id =
        Number(req.params.id);


      if (
        !Number.isInteger(id)
      ) {

        return res.status(400).json({
          error:
            "Invalid feedback ID."
        });

      }


      const result =
        db
          .prepare(`
            DELETE FROM feedback
            WHERE id = ?
          `)
          .run(id);


      if (
        result.changes === 0
      ) {

        return res.status(404).json({
          error:
            "Feedback not found."
        });

      }


      res.json({

        message:
          "Feedback deleted successfully."

      });


    } catch (error) {

      console.error(
        "DELETE feedback error:",
        error
      );


      res.status(500).json({

        error:
          "Failed to delete feedback."

      });

    }

  }
);


// =========================================================
// START SERVER
// =========================================================

app.listen(
  PORT,
  () => {

    console.log(
      `MappingSiteVN running at http://localhost:${PORT}`
    );

  }
);