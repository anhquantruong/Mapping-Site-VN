// =========================================================
// MAPPINGSITEVN ADMIN
// SQLite CRUD
// =========================================================


// =========================================================
// PAGE NAVIGATION
// =========================================================

const navItems = document.querySelectorAll(".nav-item");
const pages = document.querySelectorAll(".admin-page");


function showPage(pageName) {

  pages.forEach(page => {

    page.classList.toggle(
      "active",
      page.id === pageName
    );

  });


  navItems.forEach(item => {

    item.classList.toggle(
      "active",
      item.dataset.page === pageName
    );

  });

}


navItems.forEach(item => {

  item.addEventListener(
    "click",
    () => {

      showPage(item.dataset.page);

    }
  );

});


document
  .querySelectorAll("[data-page-link]")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        showPage(button.dataset.pageLink);

      }
    );

  });


// =========================================================
// CLINIC ELEMENTS
// =========================================================

const clinicTable =
  document.getElementById("clinicTable");

const clinicSearch =
  document.getElementById("clinicSearch");

const clinicTypeFilter =
  document.getElementById("clinicTypeFilter");

const clinicProvinceFilter =
  document.getElementById("clinicProvinceFilter");

const clinicWardFilter =
  document.getElementById("clinicWardFilter");

const clinicCount =
  document.getElementById("clinicCount");


let clinics = [];


// =========================================================
// HTML ESCAPE
// =========================================================

function escapeHTML(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


// =========================================================
// LOAD CLINICS
// =========================================================

async function loadClinics() {

  try {

    const response =
      await fetch("/api/admin/clinics");


    if (!response.ok) {

      throw new Error(
        "Failed to load clinics."
      );

    }


    clinics =
      await response.json();


    // Build type dropdown (still derived from clinic data)
    populateFilters();


    // Render table
    renderClinics();


    // Update total count
    if (clinicCount) {

      clinicCount.textContent =
        clinics.length;

    }


  } catch (error) {

    console.error(
      "Could not load clinics:",
      error
    );


    if (clinicTable) {

      clinicTable.innerHTML = `
        <tr>
          <td colspan="5">
            Failed to load clinics.
          </td>
        </tr>
      `;

    }

  }

}


// =========================================================
// VIETNAM PROVINCE / WARD API (provinces.open-api.vn v2)
// Cấu trúc hành chính mới sau sáp nhập 01/07/2025 (2 cấp:
// Tỉnh/Thành → Phường/Xã, không còn quận/huyện)
// =========================================================

const VN_PROVINCE_API =
  "https://provinces.open-api.vn/api/v2/?depth=2";

let vnProvinces = [];


async function loadVNProvinces() {

  try {

    const response =
      await fetch(VN_PROVINCE_API);


    if (!response.ok) {

      throw new Error(
        "Failed to load provinces."
      );

    }


    vnProvinces =
      await response.json();


    populateProvinceFilter();

    updateWardFilter();


    populateFormProvinceSelect();

    updateFormWardSelect();


  } catch (error) {

    console.error(
      "Could not load provinces/wards:",
      error
    );


    if (clinicProvinceFilter) {

      clinicProvinceFilter.innerHTML = `
        <option value="all">
          Không tải được danh sách tỉnh
        </option>
      `;

    }

  }

}


// =========================================================
// BUILD PROVINCE OPTIONS (từ API)
// =========================================================

function populateProvinceFilter() {

  if (!clinicProvinceFilter) {
    return;
  }


  const currentProvince =
    clinicProvinceFilter.value;


  clinicProvinceFilter.innerHTML = `
    <option value="all">
      Tất cả Tỉnh / Thành
    </option>
  `;


  vnProvinces

    .slice()

    .sort((a, b) =>
      a.name.localeCompare(b.name)
    )

    .forEach(province => {

      const option =
        document.createElement("option");


      option.value = province.name;

      option.textContent = province.name;


      clinicProvinceFilter.appendChild(
        option
      );

    });


  const stillExists =
    [...clinicProvinceFilter.options].some(
      opt => opt.value === currentProvince
    );


  if (stillExists) {

    clinicProvinceFilter.value =
      currentProvince;

  }

}


// =========================================================
// UPDATE WARD FILTER (từ API, theo tỉnh đang chọn)
// =========================================================

function updateWardFilter() {

  if (!clinicWardFilter) {
    return;
  }


  const selectedProvinceName =
    clinicProvinceFilter?.value ||
    "all";


  const currentWard =
    clinicWardFilter.value;


  clinicWardFilter.innerHTML = `
    <option value="all">
      Tất cả Phường
    </option>
  `;


  if (selectedProvinceName === "all") {

    clinicWardFilter.disabled = true;

    return;

  }


  clinicWardFilter.disabled = false;


  const province =
    vnProvinces.find(
      item => item.name === selectedProvinceName
    );


  const wards =
    (province?.wards || [])

      .slice()

      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );


  wards.forEach(ward => {

    const option =
      document.createElement("option");


    option.value = ward.name;

    option.textContent = ward.name;


    clinicWardFilter.appendChild(
      option
    );

  });


  const stillExists =
    [...clinicWardFilter.options].some(
      opt => opt.value === currentWard
    );


  if (stillExists) {

    clinicWardFilter.value =
      currentWard;

  }

}


// =========================================================
// ADD/EDIT CLINIC FORM — PROVINCE / WARD SELECTS
// Cascading dropdowns fed by the same VN API cache
// =========================================================

const formProvinceSelect =
  document.getElementById("formProvince");

const formWardSelect =
  document.getElementById("formWard");


function populateFormProvinceSelect() {

  if (!formProvinceSelect) {
    return;
  }


  const currentProvince =
    formProvinceSelect.value;


  formProvinceSelect.innerHTML = `
    <option value="">
      Select province
    </option>
  `;


  vnProvinces

    .slice()

    .sort((a, b) =>
      a.name.localeCompare(b.name)
    )

    .forEach(province => {

      const option =
        document.createElement("option");


      option.value = province.name;

      option.textContent = province.name;


      formProvinceSelect.appendChild(
        option
      );

    });


  const stillExists =
    [...formProvinceSelect.options].some(
      opt => opt.value === currentProvince
    );


  if (stillExists) {

    formProvinceSelect.value =
      currentProvince;

  }

}


function updateFormWardSelect() {

  if (!formWardSelect) {
    return;
  }


  const selectedProvinceName =
    formProvinceSelect?.value || "";


  const currentWard =
    formWardSelect.value;


  formWardSelect.innerHTML = `
    <option value="">
      Select ward
    </option>
  `;


  if (!selectedProvinceName) {

    formWardSelect.disabled = true;

    return;

  }


  formWardSelect.disabled = false;


  const province =
    vnProvinces.find(
      item => item.name === selectedProvinceName
    );


  const wards =
    (province?.wards || [])

      .slice()

      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );


  wards.forEach(ward => {

    const option =
      document.createElement("option");


    option.value = ward.name;

    option.textContent = ward.name;


    formWardSelect.appendChild(
      option
    );

  });


  const stillExists =
    [...formWardSelect.options].some(
      opt => opt.value === currentWard
    );


  if (stillExists) {

    formWardSelect.value =
      currentWard;

  }

}


formProvinceSelect?.addEventListener(
  "change",
  () => {

    updateFormWardSelect();

  }
);


// =========================================================
// BUILD FILTER OPTIONS (Type only — Province/Ward come
// from the VN administrative API above)
// =========================================================

function populateFilters() {

  // =======================================================
  // TYPE
  // =======================================================

  const types = [
    ...new Set(

      clinics

        .map(clinic =>
          String(
            clinic.clinic_type || ""
          ).trim()
        )

        .filter(Boolean)

    )
  ].sort((a, b) =>
    a.localeCompare(b)
  );


  if (clinicTypeFilter) {

    const currentType =
      clinicTypeFilter.value;


    clinicTypeFilter.innerHTML = `
      <option value="all">
        All types
      </option>
    `;


    types.forEach(type => {

      const option =
        document.createElement("option");


      option.value = type;

      option.textContent = type;


      clinicTypeFilter.appendChild(
        option
      );

    });


    // Keep previous selection if it still exists
    if (
      types.includes(currentType)
    ) {

      clinicTypeFilter.value =
        currentType;

    }

  }

}


// =========================================================
// RENDER CLINICS
// =========================================================

function renderClinics() {

  if (!clinicTable) {
    return;
  }


  // =======================================================
  // CURRENT FILTER VALUES
  // =======================================================

  const query =
    clinicSearch?.value
      ?.trim()
      .toLowerCase() || "";


  const selectedType =
    clinicTypeFilter?.value ||
    "all";


  const selectedProvince =
    clinicProvinceFilter?.value ||
    "all";


  const selectedWard =
    clinicWardFilter?.value ||
    "all";


  // =======================================================
  // FILTER
  // =======================================================

  const filteredClinics =
    clinics.filter(clinic => {


      // -----------------------------------------------------
      // SEARCH
      // -----------------------------------------------------

      const searchableText = [

        clinic.clinic_name,

        clinic.clinic_type,

        clinic.address,

        clinic.old_address,

        clinic.ward,

        clinic.prov,

        clinic.phone,

        clinic.website,

        clinic.pricing,

        clinic.description,

        clinic.target_groups

      ]

        .filter(Boolean)

        .join(" ")

        .toLowerCase();


      const matchesSearch =
        !query ||
        searchableText.includes(query);


      // -----------------------------------------------------
      // TYPE
      // -----------------------------------------------------

      const matchesType =
        selectedType === "all" ||
        String(
          clinic.clinic_type || ""
        ).trim() === selectedType;


      // -----------------------------------------------------
      // PROVINCE
      // -----------------------------------------------------

      const matchesProvince =
        selectedProvince === "all" ||
        String(
          clinic.prov || ""
        ).trim() === selectedProvince;


      // -----------------------------------------------------
      // WARD
      // -----------------------------------------------------

      const matchesWard =
        selectedWard === "all" ||
        String(
          clinic.ward || ""
        ).trim() === selectedWard;


      return (
        matchesSearch &&
        matchesType &&
        matchesProvince &&
        matchesWard
      );

    });


  // =======================================================
  // NO RESULTS
  // =======================================================

  if (
    filteredClinics.length === 0
  ) {

    clinicTable.innerHTML = `
      <tr>
        <td colspan="5">
          No clinics found.
        </td>
      </tr>
    `;

    return;

  }


  // =======================================================
  // RENDER TABLE
  // =======================================================

  clinicTable.innerHTML =
    filteredClinics

      .map(clinic => {

        return `

          <tr>

            <td>

              <strong>
                ${escapeHTML(
                  clinic.clinic_name ||
                  "Unnamed clinic"
                )}
              </strong>

              <span class="table-subtext">
                ${escapeHTML(
                  clinic.description ||
                  ""
                )}
              </span>

            </td>


            <td>
              ${escapeHTML(
                clinic.clinic_type ||
                "—"
              )}
            </td>


            <td>
              ${escapeHTML(
                clinic.prov ||
                clinic.ward ||
                "—"
              )}
            </td>


            <td>
              ${escapeHTML(
                clinic.phone ||
                "—"
              )}
            </td>


            <td>

              <button
                class="table-action edit-clinic"
                data-id="${clinic.id}"
                type="button"
              >
                Edit
              </button>


              <button
                class="table-action danger delete-clinic"
                data-id="${clinic.id}"
                type="button"
              >
                Delete
              </button>

            </td>

          </tr>

        `;

      })

      .join("");


  attachClinicActions();

}


// =========================================================
// SEARCH
// =========================================================

clinicSearch?.addEventListener(
  "input",
  renderClinics
);


// =========================================================
// TYPE FILTER
// =========================================================

clinicTypeFilter?.addEventListener(
  "change",
  renderClinics
);


// =========================================================
// PROVINCE FILTER
// =========================================================

clinicProvinceFilter?.addEventListener(
  "change",
  () => {

    // Rebuild ward options from the VN API cache
    updateWardFilter();


    // Reset ward
    if (clinicWardFilter) {

      clinicWardFilter.value =
        "all";

    }


    renderClinics();

  }
);


// =========================================================
// WARD FILTER
// =========================================================

clinicWardFilter?.addEventListener(
  "change",
  renderClinics
);


// =========================================================
// MODAL ELEMENTS
// =========================================================

const clinicModal =
  document.getElementById(
    "clinicModal"
  );

const openAddClinic =
  document.getElementById(
    "openAddClinic"
  );

const closeClinicModal =
  document.getElementById(
    "closeClinicModal"
  );

const cancelClinic =
  document.getElementById(
    "cancelClinic"
  );

const clinicForm =
  document.getElementById(
    "clinicForm"
  );


let editingClinicId = null;


// =========================================================
// OPEN MODAL
// =========================================================

function openClinicModal() {

  if (!clinicModal) {
    return;
  }


  clinicModal.classList.remove(
    "hidden"
  );


  document.body.classList.add(
    "modal-open"
  );

}


// =========================================================
// CLOSE MODAL
// =========================================================

function closeModal() {

  if (!clinicModal) {
    return;
  }


  clinicModal.classList.add(
    "hidden"
  );


  document.body.classList.remove(
    "modal-open"
  );


  editingClinicId = null;


  if (clinicForm) {

    clinicForm.reset();

  }


  // Selects don't reset cleanly on their own — resync them
  updateFormWardSelect();


  const title =
    clinicModal.querySelector(
      ".modal-header h2"
    );


  if (title) {

    title.textContent =
      "Add clinic";

  }


  const submitButton =
    clinicForm?.querySelector(
      'button[type="submit"]'
    );


  if (submitButton) {

    submitButton.textContent =
      "Add clinic";

    submitButton.disabled =
      false;

  }

}


// =========================================================
// OPEN ADD CLINIC
// =========================================================

openAddClinic?.addEventListener(
  "click",
  () => {

    editingClinicId = null;


    if (clinicForm) {

      clinicForm.reset();

    }


    // Selects don't reset cleanly on their own — resync them
    updateFormWardSelect();


    const title =
      clinicModal?.querySelector(
        ".modal-header h2"
      );


    if (title) {

      title.textContent =
        "Add clinic";

    }


    const submitButton =
      clinicForm?.querySelector(
        'button[type="submit"]'
      );


    if (submitButton) {

      submitButton.textContent =
        "Add clinic";

    }


    openClinicModal();

  }
);


// =========================================================
// CLOSE BUTTONS
// =========================================================

closeClinicModal?.addEventListener(
  "click",
  closeModal
);


cancelClinic?.addEventListener(
  "click",
  closeModal
);


document
  .querySelector(".modal-overlay")
  ?.addEventListener(
    "click",
    closeModal
  );


// =========================================================
// GET FORM DATA
// =========================================================

function getClinicFormData() {

  if (!clinicForm) {
    return {};
  }


  const formData =
    new FormData(
      clinicForm
    );


  return Object.fromEntries(
    formData.entries()
  );

}


// =========================================================
// ADD / UPDATE CLINIC
// =========================================================

clinicForm?.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const data =
      getClinicFormData();


    const isEditing =
      editingClinicId !== null;


    const url =
      isEditing
        ? `/api/admin/clinics/${editingClinicId}`
        : "/api/admin/clinics";


    const method =
      isEditing
        ? "PUT"
        : "POST";


    const submitButton =
      clinicForm.querySelector(
        'button[type="submit"]'
      );


    const originalText =
      submitButton?.textContent ||
      "";


    try {

      if (submitButton) {

        submitButton.disabled =
          true;


        submitButton.textContent =
          isEditing
            ? "Saving..."
            : "Adding...";

      }


      const response =
        await fetch(
          url,
          {
            method,

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify(data)
          }
        );


      let result = {};


      try {

        result =
          await response.json();

      } catch {

        result = {};

      }


      if (!response.ok) {

        const details =
          Array.isArray(
            result.details
          )
            ? "\n\n" +
              result.details.join(
                "\n"
              )
            : "";


        throw new Error(
          (
            result.error ||
            "Something went wrong."
          ) +
          details
        );

      }


      alert(
        isEditing
          ? "Clinic updated successfully."
          : "Clinic added successfully."
      );


      closeModal();


      // Reload actual data from SQLite
      await loadClinics();


    } catch (error) {

      console.error(
        "Clinic save error:",
        error
      );


      alert(
        error.message ||
        "Failed to save clinic."
      );


    } finally {

      if (submitButton) {

        submitButton.disabled =
          false;


        submitButton.textContent =
          originalText;

      }

    }

  }
);


// =========================================================
// EDIT CLINIC
// =========================================================

function editClinic(id) {

  const clinic =
    clinics.find(
      item =>
        Number(item.id) ===
        Number(id)
    );


  if (!clinic) {

    alert(
      "Clinic could not be found."
    );

    return;

  }


  editingClinicId =
    Number(id);


  // Fill every form field
  const fields =
    clinicForm.querySelectorAll(
      "[name]"
    );


  fields.forEach(field => {

    const value =
      clinic[field.name];


    if (
      value !== undefined &&
      value !== null
    ) {

      field.value =
        String(value);

    } else {

      field.value = "";

    }

  });


  // Province select is now set from the generic loop above —
  // rebuild the ward options for that province, then re-apply
  // the clinic's saved ward (the generic loop ran before the
  // matching ward options existed, so it couldn't select it).
  updateFormWardSelect();

  if (formWardSelect) {

    formWardSelect.value =
      clinic.ward || "";

  }


  const title =
    clinicModal?.querySelector(
      ".modal-header h2"
    );


  if (title) {

    title.textContent =
      "Edit clinic";

  }


  const submitButton =
    clinicForm?.querySelector(
      'button[type="submit"]'
    );


  if (submitButton) {

    submitButton.textContent =
      "Save changes";

  }


  openClinicModal();

}


// =========================================================
// DELETE CLINIC
// =========================================================

async function deleteClinic(id) {

  const clinic =
    clinics.find(
      item =>
        Number(item.id) ===
        Number(id)
    );


  if (!clinic) {

    alert(
      "Clinic could not be found."
    );

    return;

  }


  const confirmed =
    confirm(
      `Delete "${clinic.clinic_name}"?\n\nThis action cannot be undone.`
    );


  if (!confirmed) {

    return;

  }


  try {

    const response =
      await fetch(
        `/api/admin/clinics/${id}`,
        {
          method: "DELETE"
        }
      );


    let result = {};


    try {

      result =
        await response.json();

    } catch {

      result = {};

    }


    if (!response.ok) {

      throw new Error(
        result.error ||
        "Failed to delete clinic."
      );

    }


    alert(
      "Clinic deleted successfully."
    );


    // Reload actual database data
    await loadClinics();


  } catch (error) {

    console.error(
      "Delete error:",
      error
    );


    alert(
      error.message ||
      "Failed to delete clinic."
    );

  }

}


// =========================================================
// EDIT / DELETE BUTTONS
// =========================================================

function attachClinicActions() {


  document
    .querySelectorAll(
      ".edit-clinic"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          editClinic(
            button.dataset.id
          );

        }
      );

    });


  document
    .querySelectorAll(
      ".delete-clinic"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          deleteClinic(
            button.dataset.id
          );

        }
      );

    });

}


// =========================================================
// LOGOUT
// =========================================================

document
  .getElementById(
    "logoutButton"
  )
  ?.addEventListener(
    "click",
    () => {

      alert(
        "Authentication will be connected next."
      );

    }
  );


// =========================================================
// INITIALIZE
// =========================================================

loadClinics();
loadVNProvinces();