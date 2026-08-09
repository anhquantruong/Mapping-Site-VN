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


    // Build dropdown options
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
// BUILD FILTER OPTIONS
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


  // =======================================================
  // PROVINCE / CITY
  // =======================================================

  const provinces = [
    ...new Set(

      clinics

        .map(clinic =>
          String(
            clinic.prov || ""
          ).trim()
        )

        .filter(Boolean)

    )
  ].sort((a, b) =>
    a.localeCompare(b)
  );


  if (clinicProvinceFilter) {

    const currentProvince =
      clinicProvinceFilter.value;


    clinicProvinceFilter.innerHTML = `
      <option value="all">
        All provinces / cities
      </option>
    `;


    provinces.forEach(province => {

      const option =
        document.createElement("option");


      option.value = province;

      option.textContent = province;


      clinicProvinceFilter.appendChild(
        option
      );

    });


    if (
      provinces.includes(
        currentProvince
      )
    ) {

      clinicProvinceFilter.value =
        currentProvince;

    }

  }


  // Build ward list based on selected province
  updateWardFilter();

}


// =========================================================
// UPDATE WARD FILTER
// =========================================================

function updateWardFilter() {

  if (!clinicWardFilter) {
    return;
  }


  const selectedProvince =
    clinicProvinceFilter?.value ||
    "all";


  const wards = [
    ...new Set(

      clinics

        .filter(clinic => {

          if (
            selectedProvince === "all"
          ) {

            return true;

          }


          return (
            String(
              clinic.prov || ""
            ).trim() ===
            selectedProvince
          );

        })

        .map(clinic =>
          String(
            clinic.ward || ""
          ).trim()
        )

        .filter(Boolean)

    )
  ].sort((a, b) =>
    a.localeCompare(b)
  );


  const currentWard =
    clinicWardFilter.value;


  clinicWardFilter.innerHTML = `
    <option value="all">
      All wards
    </option>
  `;


  wards.forEach(ward => {

    const option =
      document.createElement("option");


    option.value = ward;

    option.textContent = ward;


    clinicWardFilter.appendChild(
      option
    );

  });


  // Keep ward only if it still belongs to selected province
  if (
    wards.includes(currentWard)
  ) {

    clinicWardFilter.value =
      currentWard;

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

    // Rebuild ward options
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