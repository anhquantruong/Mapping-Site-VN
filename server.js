require("dotenv").config();

const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");
const session = require("express-session");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = process.env.PORT || 3000;


// =========================================================
// REQUIRED ENV VARS
// =========================================================
//
// SESSION_SECRET        random long string (see .env.example)
// ADMIN_USERNAME         plain text username, e.g. "admin"
// ADMIN_PASSWORD_HASH    bcrypt hash of the real password
//                         (never the plain password itself)
//
// None of these ever get sent to the browser — they only ever
// live in the server process. This is what keeps the login
// invisible in DevTools, unlike a client-side JS check.
// =========================================================

const {
  SESSION_SECRET,
  ADMIN_USERNAME,
  ADMIN_PASSWORD_HASH
} = process.env;

if (!SESSION_SECRET || !ADMIN_USERNAME || !ADMIN_PASSWORD_HASH) {

  console.error(
    "Thiếu SESSION_SECRET / ADMIN_USERNAME / ADMIN_PASSWORD_HASH trong .env — server không khởi động. Xem .env.example."
  );

  process.exit(1);

}


// =========================================================
// MIDDLEWARE
// =========================================================

app.use(express.json());

// Cần thiết nếu deploy sau reverse proxy (Render, Railway, Nginx...)
// để cookie "secure" hoạt động đúng qua HTTPS.
app.set("trust proxy", 1);

app.use(
  session({
    name: "msvn.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true, // JS phía client (kể cả DevTools console) không đọc được cookie này
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production", // bắt buộc HTTPS khi lên production
      maxAge: 1000 * 60 * 60 * 8 // hết hạn sau 8 giờ
    }
  })
);


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
// We keep that structure and extend it with:
// is_read        0/1 — admin đã bấm "Xem" chi tiết chưa
// reply_message  nội dung admin trả lời (lưu nội bộ)
// replied_at     thời điểm gửi trả lời
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
    status TEXT DEFAULT 'new',
    is_read INTEGER DEFAULT 0,
    reply_message TEXT,
    replied_at TEXT
  )
`).run();


// =========================================================
// MIGRATE — thêm cột mới nếu bảng feedback đã tồn tại từ
// trước (được tạo trước khi có is_read / reply_message /
// replied_at). Không ảnh hưởng tới dữ liệu cũ.
// =========================================================

const feedbackColumns =
  db
    .prepare(`PRAGMA table_info(feedback)`)
    .all()
    .map(col => col.name);

if (!feedbackColumns.includes("is_read")) {

  db.prepare(`
    ALTER TABLE feedback
    ADD COLUMN is_read INTEGER DEFAULT 0
  `).run();

}

if (!feedbackColumns.includes("reply_message")) {

  db.prepare(`
    ALTER TABLE feedback
    ADD COLUMN reply_message TEXT
  `).run();

}

if (!feedbackColumns.includes("replied_at")) {

  db.prepare(`
    ALTER TABLE feedback
    ADD COLUMN replied_at TEXT
  `).run();

}


// =========================================================
// AUTH — LOGIN BRUTE-FORCE GUARD (per IP, in-memory)
// =========================================================

const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 phút


function isLockedOut(ip) {

  const entry = loginAttempts.get(ip);

  if (!entry) return false;

  if (entry.count < MAX_ATTEMPTS) return false;

  if (Date.now() - entry.lastAttempt > LOCKOUT_MS) {

    loginAttempts.delete(ip);

    return false;

  }

  return true;

}

function registerFailedAttempt(ip) {

  const entry =
    loginAttempts.get(ip) ||
    { count: 0, lastAttempt: 0 };

  entry.count += 1;

  entry.lastAttempt = Date.now();

  loginAttempts.set(ip, entry);

}

function clearAttempts(ip) {

  loginAttempts.delete(ip);

}


// =========================================================
// AUTH — MIDDLEWARE
// =========================================================

function requireAuth(req, res, next) {

  if (req.session && req.session.isAdmin) {

    return next();

  }

  return res.status(401).json({
    error: "Unauthorized."
  });

}


// =========================================================
// AUTH — ROUTES
// (đặt TRƯỚC app.use("/api/admin", requireAuth) bên dưới,
// nếu không sẽ tự khoá luôn chính route đăng nhập)
// =========================================================

app.post(
  "/api/admin/login",
  async (req, res) => {

    const ip = req.ip;


    if (isLockedOut(ip)) {

      return res.status(429).json({
        error:
          "Quá nhiều lần đăng nhập sai. Vui lòng thử lại sau 15 phút."
      });

    }


    const { username, password } =
      req.body || {};


    if (!username || !password) {

      return res.status(400).json({
        error:
          "Vui lòng nhập tên đăng nhập và mật khẩu."
      });

    }


    const validUsername =
      username === ADMIN_USERNAME;

    const validPassword =
      await bcrypt.compare(
        password,
        ADMIN_PASSWORD_HASH
      );


    if (!validUsername || !validPassword) {

      registerFailedAttempt(ip);

      return res.status(401).json({
        error:
          "Sai tên đăng nhập hoặc mật khẩu."
      });

    }


    clearAttempts(ip);


    // regenerate() để tránh session fixation
    req.session.regenerate(err => {

      if (err) {

        return res.status(500).json({
          error: "Đăng nhập thất bại."
        });

      }


      req.session.isAdmin = true;

      req.session.username = username;


      res.json({
        message: "Đăng nhập thành công."
      });

    });

  }
);


app.post(
  "/api/admin/logout",
  (req, res) => {

    if (!req.session) {

      return res.json({
        message: "Đã đăng xuất."
      });

    }


    req.session.destroy(() => {

      res.clearCookie("msvn.sid");

      res.json({
        message: "Đã đăng xuất."
      });

    });

  }
);


app.get(
  "/api/admin/session",
  (req, res) => {

    res.json({
      authenticated:
        !!(req.session && req.session.isAdmin)
    });

  }
);


// =========================================================
// AUTH — PROTECT ADMIN DASHBOARD (static HTML/JS/CSS)
// =========================================================
//
// Mọi request tới /admin/... đều cần session hợp lệ, TRỪ
// login.html và các asset riêng của trang login.
// Đặt middleware này TRƯỚC express.static để chặn được
// trước khi file tĩnh được trả về.
// =========================================================

const OPEN_ADMIN_PATHS = [
  "/login.html",
  "/login.css",
  "/login.js"
];

app.use("/admin", (req, res, next) => {

  if (OPEN_ADMIN_PATHS.includes(req.path)) {

    return next();

  }


  if (req.session && req.session.isAdmin) {

    return next();

  }


  return res.redirect("/admin/login.html");

});


// =========================================================
// AUTH — PROTECT ADMIN API
// (mọi route /api/admin/* định nghĩa PHÍA DƯỚI dòng này sẽ
// yêu cầu đăng nhập — login/logout/session ở trên không bị
// ảnh hưởng vì đã được match trước đó)
// =========================================================

app.use("/api/admin", requireAuth);


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
              ggmaps_link,
              operating_hours,
              license_number,
              license_issue_date,
              description,
              target_groups,
              price,
              service

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
              @ggmaps_link,
              @operating_hours,
              @license_number,
              @license_issue_date,
              @description,
              @target_groups,
              @price,
              @service

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

            ggmaps_link:
              data.ggmaps_link?.trim() || "",

            operating_hours:
              data.operating_hours?.trim() || "",

            license_number:
              data.license_number?.trim() || "",

            license_issue_date:
              data.license_issue_date || "",

            description:
              data.description?.trim() || "",

            target_groups:
              data.target_groups?.trim() || "",

            price:
              data.price?.trim() || "",

            service:
              data.service?.trim() || ""

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

            ggmaps_link =
              @ggmaps_link,

            operating_hours =
              @operating_hours,

            license_number =
              @license_number,

            license_issue_date =
              @license_issue_date,

            description =
              @description,

            target_groups =
              @target_groups,

            price =
              @price,

            service =
              @service

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

          ggmaps_link:
            data.ggmaps_link?.trim() || "",

          operating_hours:
            data.operating_hours?.trim() || "",

          license_number:
            data.license_number?.trim() || "",

          license_issue_date:
            data.license_issue_date || "",

          description:
            data.description?.trim() || "",

          target_groups:
            data.target_groups?.trim() || "",

          price:
            data.price?.trim() || "",

          service:
            data.service?.trim() || ""

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
              status,
              is_read,
              reply_message,
              replied_at

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
// GET ONE FEEDBACK — ADMIN
// (dùng khi mở box chi tiết, đảm bảo dữ liệu mới nhất)
// =========================================================

app.get(
  "/api/admin/feedback/:id",
  (req, res) => {

    try {

      const id =
        Number(req.params.id);


      if (!Number.isInteger(id)) {

        return res.status(400).json({
          error:
            "Invalid feedback ID."
        });

      }


      const item =
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
              status,
              is_read,
              reply_message,
              replied_at

            FROM feedback

            WHERE id = ?
          `)
          .get(id);


      if (!item) {

        return res.status(404).json({
          error:
            "Feedback not found."
        });

      }


      res.json(item);


    } catch (error) {

      console.error(
        "GET one feedback error:",
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
// MARK FEEDBACK AS READ — ADMIN
// Gọi khi admin bấm "Xem" để mở box chi tiết. Đây là điều
// kiện đổi màu dòng (đậm = chưa đọc, nhạt = đã đọc).
// =========================================================

app.post(
  "/api/admin/feedback/:id/read",
  (req, res) => {

    try {

      const id =
        Number(req.params.id);


      if (!Number.isInteger(id)) {

        return res.status(400).json({
          error:
            "Invalid feedback ID."
        });

      }


      const result =
        db
          .prepare(`
            UPDATE feedback

            SET is_read = 1

            WHERE id = ?
          `)
          .run(id);


      if (result.changes === 0) {

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
          "Feedback marked as read.",

        feedback:
          updated

      });


    } catch (error) {

      console.error(
        "Mark feedback read error:",
        error
      );


      res.status(500).json({

        error:
          "Failed to mark feedback as read."

      });

    }

  }
);


// =========================================================
// REPLY TO FEEDBACK — ADMIN
// =========================================================
//
// Lưu nội dung admin trả lời (nội bộ — CHƯA gửi email thật,
// sẽ nối SMTP/API email sau). Khi lưu thành công, feedback
// tự động được đánh dấu is_read = 1 và status = 'resolved'.
// =========================================================

app.post(
  "/api/admin/feedback/:id/reply",
  (req, res) => {

    try {

      const id =
        Number(req.params.id);


      if (!Number.isInteger(id)) {

        return res.status(400).json({
          error:
            "Invalid feedback ID."
        });

      }


      const {
        reply_message
      } = req.body || {};


      if (
        !reply_message ||
        typeof reply_message !== "string" ||
        !reply_message.trim()
      ) {

        return res.status(400).json({
          error:
            "Nội dung trả lời không được để trống."
        });

      }


      const existing =
        db
          .prepare(`
            SELECT id
            FROM feedback
            WHERE id = ?
          `)
          .get(id);


      if (!existing) {

        return res.status(404).json({
          error:
            "Feedback not found."
        });

      }


      db
        .prepare(`
          UPDATE feedback

          SET

            reply_message = @reply_message,
            replied_at = CURRENT_TIMESTAMP,
            status = 'resolved',
            is_read = 1

          WHERE id = @id
        `)
        .run({
          id,
          reply_message:
            reply_message.trim()
        });


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
          "Reply saved successfully.",

        feedback:
          updated

      });


    } catch (error) {

      console.error(
        "Reply feedback error:",
        error
      );


      res.status(500).json({

        error:
          "Failed to save reply."

      });

    }

  }
);


// =========================================================
// UPDATE FEEDBACK STATUS — ADMIN
// (chỉnh tay, độc lập với việc trả lời)
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
// PUBLIC — GET ALL CLINICS (dùng cho trang kết quả results.html,
// KHÔNG yêu cầu đăng nhập admin, vì đây là trang người dùng xem)
// =========================================================

app.get(
  "/api/clinics",
  (req, res) => {

    try {

      const clinics =
        db
          .prepare(`
            SELECT *
            FROM clinics
            ORDER BY id ASC
          `)
          .all();


      res.json(clinics);


    } catch (error) {

      console.error(
        "GET /api/clinics error:",
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