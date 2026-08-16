/* ============================================================
   results.js
   Pipeline: Form (sessionStorage từ script.js) -> Lọc theo bán kính +
   loại hình -> Xếp hạng theo 3 tầng ưu tiên (Target groups hỗ trợ >
   Loại hình phòng khám > Dịch vụ thăm khám / chủ đề) -> Hiển thị
   Card + Map. KHÔNG dùng điểm số phù hợp (%) — chỉ xếp hạng theo
   thứ tự ưu tiên nói trên, khoảng cách chỉ là tiêu chí phân định
   cuối cùng khi mọi thứ khác bằng nhau.

   Nếu người dùng chọn "Tôi sẵn sàng đi xa để tìm cơ sở phù hợp"
   (q5 === 2), bán kính TỰ ĐỘNG chuyển về không giới hạn.

   YÊU CẦU BACKEND (bạn cần có sẵn, giống /api/feedback đã có):
   GET /api/clinics
   -> trả JSON: [{
        id, clinic_name, clinic_type, address, old_address, ward, prov,
        latitude, longitude, pricing, price, phone, website, ggmaps_link,
        operating_hours, license_number, license_issue_date,
        description, target_groups, service
      }, ...]
   (SELECT * FROM clinics trong mappingsite.db)

   Nếu chưa có endpoint này, xem MOCK_CLINICS bên dưới — đặt
   FORCE_MOCK = true để test giao diện trước.
   ============================================================ */

(function () {
  'use strict';

  const STORAGE_KEY = 'mappingWizardResult';
  const CLINICS_API = '/api/clinics';
  const FORCE_MOCK = false; // đổi thành true để luôn dùng dữ liệu mẫu khi test

  // Quy đổi tạm "sẵn sàng đi bao lâu" (q5b) -> bán kính km
  // (ước lượng ~20km/h di chuyển nội thành, chỉ dùng làm gợi ý mặc định)
  const MINUTES_TO_KM = { 0: 2, 1: 5, 2: 8, 3: 0 }; // 3 = không giới hạn
  const DEFAULT_RADIUS_KM = 5;

  // Toạ độ trung tâm TP.HCM — dùng làm fallback cuối cùng nếu không
  // thể lấy GPS lẫn không geocode được địa chỉ
  const FALLBACK_CENTER = { lat: 10.7769, lng: 106.7009 };

  /* ============================================================
     0) Danh sách chủ đề — PHẢI cùng thứ tự với questions.js (q8/q9)
        để answers.q8 / answers.q9 (mảng index) tra đúng nhãn.
     ============================================================ */
  const TOPICS_Q8 = [
    { vi: 'Lo âu', en: 'Anxiety', kw: ['lo âu', 'anxiety'] },
    { vi: 'Trầm cảm', en: 'Depression', kw: ['trầm cảm', 'depression'] },
    { vi: 'Stress', en: 'Stress', kw: ['stress', 'căng thẳng'] },
    { vi: 'Kiệt sức', en: 'Burnout', kw: ['kiệt sức', 'burnout'] },
    { vi: 'Khủng hoảng cảm xúc', en: 'Emotional crisis', kw: ['khủng hoảng', 'crisis'] },
    { vi: 'Mất ngủ', en: 'Insomnia', kw: ['mất ngủ', 'insomnia'] },
    { vi: 'Quan hệ gia đình', en: 'Family relationships', kw: ['gia đình', 'family'] },
    { vi: 'Quan hệ tình cảm', en: 'Romantic relationships', kw: ['tình cảm', 'relationship'] },
    { vi: 'Hôn nhân', en: 'Marriage', kw: ['hôn nhân', 'marriage'] },
    { vi: 'Nuôi dạy con', en: 'Parenting', kw: ['nuôi dạy con', 'parenting'] },
    { vi: 'Sang chấn', en: 'Trauma', kw: ['sang chấn', 'trauma'] },
    { vi: 'ADHD', en: 'ADHD', kw: ['adhd', 'tăng động'] },
    { vi: 'Phổ Tự kỷ', en: 'Autism Spectrum Disorder', kw: ['tự kỷ', 'autism'] },
    { vi: 'Rối loạn ăn uống', en: 'Eating disorders', kw: ['ăn uống', 'eating disorder'] },
    { vi: 'Nghiện', en: 'Addiction', kw: ['nghiện', 'addiction'] },
    { vi: 'Khó khăn trong học tập', en: 'Academic difficulties', kw: ['học tập', 'academic'] },
    { vi: 'Khó khăn trong công việc', en: 'Work difficulties', kw: ['công việc', 'work'] },
    { vi: 'Khác', en: 'Other', kw: [] },
  ];
  const TOPICS_Q9 = [
    { vi: 'Hỗ trợ LGBTQ+', en: 'LGBTQ+ support', kw: ['lgbt', 'lgbtq'] },
    { vi: 'Hỗ trợ người bệnh H.', en: 'Support for people living with HIV', kw: ['hiv', 'người bệnh h'] },
    { vi: 'Hỗ trợ Nhân viên Y Tế', en: 'Support for healthcare workers', kw: ['nhân viên y tế', 'healthcare worker'] },
    { vi: 'Hỗ trợ nạn nhân nạn buôn bán người', en: 'Support for survivors of human trafficking', kw: ['buôn bán người', 'trafficking'] },
    { vi: 'Hỗ trợ nạn nhân bạo lực học đường / bạo lực gia đình', en: 'Support for survivors of school or domestic violence', kw: ['bạo lực', 'violence'] },
    { vi: 'Hỗ trợ người mắc bệnh mạn tính', en: 'Support for people with chronic illness', kw: ['bệnh mạn tính', 'chronic illness'] },
  ];
  const FACILITY_TYPE_OPTS = [
    { vi: 'Công lập', en: 'Public' },
    { vi: 'Tư nhân', en: 'Private' },
    { vi: 'Không quan trọng', en: 'No preference' },
  ];

  // Từ khoá độ tuổi (q2) — dùng để đối chiếu với target_groups/description,
  // cùng nhóm chỉ số với 6 lựa chọn q2 trong questions.js.
  const AGE_GROUP_KEYWORDS = [
    { vi: 'Dưới 12 tuổi', en: 'Under 12', kw: ['trẻ em', 'nhi', 'children', 'child'] },
    { vi: '12–17 tuổi', en: '12–17', kw: ['vị thành niên', 'thanh thiếu niên', 'teen', 'adolescen'] },
    { vi: '18–25 tuổi', en: '18–25', kw: ['thanh niên', 'người trẻ', 'sinh viên', 'young adult'] },
    { vi: '26–40 tuổi', en: '26–40', kw: ['người lớn', 'adult'] },
    { vi: '41–60 tuổi', en: '41–60', kw: ['người lớn', 'trung niên', 'adult'] },
    { vi: 'Trên 60 tuổi', en: 'Over 60', kw: ['người cao tuổi', 'elderly', 'senior'] },
  ];

  /* ============================================================
     1) DỮ LIỆU MẪU — dùng khi /api/clinics chưa sẵn sàng
     ============================================================ */
  const MOCK_CLINICS = [
    {
      id: 1, clinic_name: 'Bệnh viện Tâm Thần TP. HCM',
      clinic_type: 'Công lập',
      address: '766 Võ Văn Kiệt, Phường 1, Quận 5, TP. HCM',
      old_address: '766 Võ Văn Kiệt, Phường 1, Quận 5',
      ward: 'Phường 1', prov: 'TP. Hồ Chí Minh',
      latitude: 10.7546, longitude: 106.6673,
      pricing: 'Theo bảo hiểm y tế / thu phí công lập',
      phone: '028 3923 4675', website: 'https://bvtt-tphcm.org.vn',
      operating_hours: 'Thứ 2 - Thứ 6, 7:00 - 16:30',
      license_number: 'GPHĐ-0119/BYT-HCM', license_issue_date: '2015-03-10',
      description: 'Bệnh viện chuyên khoa tâm thần tuyến thành phố, điều trị rối loạn lo âu, trầm cảm, sang chấn, rối loạn ăn uống, nghiện.',
      target_groups: 'Người lớn, trẻ em, hỗ trợ nhân viên y tế',
    },
    {
      id: 2, clinic_name: 'Phòng khám Tâm lý An Nhiên',
      clinic_type: 'Tư nhân',
      address: '12 Trần Não, Phường An Khánh, TP. Thủ Đức, TP. HCM',
      old_address: '12 Trần Não, An Khánh, Quận 2',
      ward: 'Phường An Khánh', prov: 'TP. Hồ Chí Minh',
      latitude: 10.7899, longitude: 106.7259,
      pricing: '400.000đ - 700.000đ / buổi',
      phone: '090 123 4567', website: 'https://annhien.example.com',
      operating_hours: 'Hằng ngày, 8:00 - 20:00',
      license_number: 'GPHĐ-0288/SYT-HCM', license_issue_date: '2021-06-01',
      description: 'Tham vấn cá nhân cho lo âu, stress, kiệt sức, khủng hoảng cảm xúc, quan hệ tình cảm và hôn nhân.',
      target_groups: 'Thanh niên, người trẻ đi làm, cặp đôi',
    },
    {
      id: 3, clinic_name: 'Trung tâm Hỗ trợ Trẻ em & Gia đình Cầu Vồng',
      clinic_type: 'Tư nhân',
      address: '45 Nguyễn Thị Thập, Phường Tân Phú, Quận 7, TP. HCM',
      old_address: '45 Nguyễn Thị Thập, Tân Phú, Quận 7',
      ward: 'Phường Tân Phú', prov: 'TP. Hồ Chí Minh',
      latitude: 10.7295, longitude: 106.7217,
      pricing: '350.000đ - 600.000đ / buổi',
      phone: '028 7300 1122', website: '',
      operating_hours: 'Thứ 2 - Thứ 7, 8:30 - 17:30',
      license_number: '', license_issue_date: '',
      description: 'Chuyên can thiệp ADHD, Phổ tự kỷ, khó khăn học tập ở trẻ em; tư vấn nuôi dạy con cho phụ huynh.',
      target_groups: 'Trẻ em, phụ huynh',
    },
    {
      id: 4, clinic_name: 'Trạm Y tế Phường Bến Nghé',
      clinic_type: 'Công lập',
      address: '5 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. HCM',
      old_address: '5 Nguyễn Huệ, Bến Nghé, Quận 1',
      ward: 'Phường Bến Nghé', prov: 'TP. Hồ Chí Minh',
      latitude: 10.7745, longitude: 106.7038,
      pricing: 'Theo bảo hiểm y tế',
      phone: '028 3822 1010', website: '',
      operating_hours: 'Thứ 2 - Thứ 6, 7:30 - 16:00',
      license_number: 'GPHĐ-0044/BYT-HCM', license_issue_date: '2012-01-20',
      description: 'Tư vấn ban đầu về sức khoẻ tâm thần, chuyển tuyến khi cần, hỗ trợ mất ngủ, stress nhẹ.',
      target_groups: 'Người dân trong phường, người cao tuổi',
    },
    {
      id: 5, clinic_name: 'Phòng khám Mind Space',
      clinic_type: 'Tư nhân',
      address: '88 Pasteur, Phường Bến Nghé, Quận 1, TP. HCM',
      old_address: '88 Pasteur, Bến Nghé, Quận 1',
      ward: 'Phường Bến Nghé', prov: 'TP. Hồ Chí Minh',
      latitude: 10.7789, longitude: 106.6989,
      pricing: '600.000đ - 900.000đ / buổi',
      phone: '090 888 2233', website: 'https://mindspace.example.com',
      operating_hours: 'Hằng ngày, 9:00 - 21:00',
      license_number: 'GPHĐ-0355/SYT-HCM', license_issue_date: '2023-02-14',
      description: 'Không gian trị liệu thân thiện với cộng đồng LGBTQ+, hỗ trợ sang chấn, khủng hoảng cảm xúc, rối loạn ăn uống.',
      target_groups: 'Hỗ trợ LGBTQ+, người trẻ',
    },
    {
      id: 6, clinic_name: 'Trung tâm Tham vấn Sen Việt',
      clinic_type: 'Tư nhân',
      address: '120 Đồng Khởi, Phường Bến Thành, Quận 1, TP. HCM',
      old_address: '120 Đồng Khởi, Bến Thành, Quận 1',
      ward: 'Phường Bến Thành', prov: 'TP. Hồ Chí Minh',
      latitude: 10.7737, longitude: 106.7030,
      pricing: '450.000đ - 800.000đ / buổi',
      phone: '028 3999 4455', website: 'https://senviet.example.com',
      operating_hours: 'Thứ 2 - Chủ nhật, 8:00 - 19:00',
      license_number: '', license_issue_date: '',
      description: 'Tham vấn nghiện, phục hồi sau sang chấn, hỗ trợ nạn nhân bạo lực gia đình và học đường.',
      target_groups: 'Hỗ trợ nạn nhân bạo lực học đường / bạo lực gia đình',
    },
  ];

  /* ============================================================
     2) STATE
     ============================================================ */
  const state = {
    lang: 'vi',
    answers: null,
    location: null,       // { provinceVi, provinceEn, wardVi, wardEn }
    refPoint: null,       // { lat, lng } dùng làm gốc tính khoảng cách
    radiusKm: DEFAULT_RADIUS_KM,
    clinics: [],
    matches: [],           // đã lọc + chấm điểm + sắp xếp
    currentIndex: 0,
    map: null,
    markers: {},            // id -> L.marker
    usingMock: false,       // true nếu đang hiển thị dữ liệu MẪU (không phải từ mappingsite.db)
  };

  const $ = (id) => document.getElementById(id);

  /* ============================================================
     3) LOAD STATE TỪ WIZARD (script.js lưu vào sessionStorage)
     ============================================================ */
  function loadWizardData() {
    let raw;
    try {
      raw = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
    } catch (e) {
      raw = null;
    }
    if (!raw || !raw.answers) {
      showNoDataAndRedirect();
      return false;
    }
    state.answers = raw.answers;
    state.location = raw.location || {};
    state.lang = document.body.getAttribute('data-lang') || 'vi';
    return true;
  }

  function showNoDataAndRedirect() {
    $('resultsLoading').classList.add('hidden');
    $('resultsEmpty').classList.remove('hidden');
    $('resultsEmpty').querySelector('h3').innerHTML =
      '<span lang-el="vi">Chưa có dữ liệu sàng lọc</span><span lang-el="en">No screening data found</span>';
    $('resultsEmpty').querySelector('p').innerHTML =
      '<span lang-el="vi">Đang đưa bạn về trang chủ để bắt đầu…</span><span lang-el="en">Redirecting you to the homepage to start…</span>';
    setTimeout(() => { window.location.href = '../app/index.html'; }, 2500);
  }

  /* ============================================================
     4) LẤY TOẠ ĐỘ THAM CHIẾU (GPS hoặc geocode Phường/Tỉnh)
     ============================================================ */
  function getReferencePoint() {
    return new Promise((resolve) => {
      const wantsNearestMe = state.answers.q5 === 0;

      if (wantsNearestMe && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, source: 'gps' }),
          () => geocodeSelectedWard().then(resolve),
          { timeout: 8000 }
        );
      } else {
        geocodeSelectedWard().then(resolve);
      }
    });
  }

  async function geocodeSelectedWard() {
    const { wardVi, provinceVi } = state.location || {};
    if (!wardVi && !provinceVi) return { ...FALLBACK_CENTER, source: 'fallback' };

    const q = [wardVi, provinceVi, 'Việt Nam'].filter(Boolean).join(', ');
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`
      );
      const data = await res.json();
      if (data && data[0]) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), source: 'geocode' };
      }
    } catch (e) {
      console.warn('Geocode thất bại, dùng toạ độ mặc định:', e);
    }
    return { ...FALLBACK_CENTER, source: 'fallback' };
  }

  /* ============================================================
     5) LẤY DANH SÁCH PHÒNG KHÁM TỪ mappingsite.db (table clinics)
     ============================================================ */
  async function loadClinics() {
    if (FORCE_MOCK) {
      state.usingMock = true;
      return MOCK_CLINICS;
    }
    try {
      const res = await fetch(CLINICS_API);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Phản hồi /api/clinics không đúng định dạng mảng');
      // Mảng rỗng KHÔNG phải lỗi — nghĩa là bảng "clinics" trong
      // mappingsite.db thật sự chưa có phòng khám nào. Đây là dữ liệu
      // thật, không fallback sang mock.
      state.usingMock = false;
      return data;
    } catch (e) {
      console.warn('Không gọi được /api/clinics, tạm dùng dữ liệu MẪU để test giao diện:', e);
      state.usingMock = true;
      return MOCK_CLINICS;
    }
  }

  /* ============================================================
     6) TIỆN ÍCH: khoảng cách Haversine (km)
     ============================================================ */
  function haversineKm(a, b) {
    if (!a || !b || a.lat == null || b.latitude == null) return null;
    const R = 6371;
    const dLat = ((b.latitude - a.lat) * Math.PI) / 180;
    const dLng = ((b.longitude - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.latitude * Math.PI) / 180;
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  // Ánh xạ giá trị clinic_type THẬT trong database (mình đặt tự do,
  // vd "Bệnh viện công lập") sang nhóm lọc dùng trong thuật toán:
  // 'public' | 'private' | 'community' (luôn được đề xuất, không lọc
  // theo loại hình — chỉ phân biệt qua giá & nhóm đối tượng).
  // "Dịch vụ trực tuyến" đã bị bỏ khỏi hệ thống nên không cần map.
  const CLINIC_TYPE_MAP = {
    'bệnh viện công lập': 'public',
    'bệnh viện tư nhân': 'private',
    'phòng khám tư nhân': 'private',
    'tổ chức cộng đồng': 'community',
  };

  function normType(clinicType) {
    const t = (clinicType || '').trim().toLowerCase();
    if (CLINIC_TYPE_MAP[t]) return CLINIC_TYPE_MAP[t];
    // fallback nếu giá trị trong DB không khớp chính xác chuỗi trên
    // (vd gõ khác hoa/thường, thừa khoảng trắng...)
    if (t.includes('cộng đồng')) return 'community';
    if (t.includes('công lập')) return 'public';
    if (t.includes('tư nhân')) return 'private';
    return 'other';
  }

  function textIncludesAny(text, kwList) {
    const t = (text || '').toLowerCase();
    return kwList.some((kw) => kw && t.includes(kw));
  }

  /* ============================================================
     7) ĐÁNH GIÁ MỖI CƠ SỞ — KHÔNG còn điểm số phù hợp (%).
        Trả về danh sách các mục khớp theo 3 tầng ưu tiên, dùng để
        SẮP XẾP (xem computeMatches) và để sinh văn bản giải thích.
        Tầng 1: Target groups hỗ trợ (nhóm đặc biệt q9 + độ tuổi q2)
        Tầng 2: Loại hình phòng khám (q6/q7)
        Tầng 3: Dịch vụ thăm khám / chủ đề quan tâm (q8)
     ============================================================ */
  function evaluateClinic(clinic) {
    const a = state.answers;

    // ----- Tầng 1: Target groups hỗ trợ -----
    // allSpecialTags: TẤT CẢ nhóm đặc biệt mà cơ sở này có gắn tag
    // (dùng để lọc cứng bên dưới trong computeMatches — nếu cơ sở
    // CHỈ chuyên biệt cho 1 nhóm khác với lựa chọn của người dùng,
    // sẽ bị loại thay vì chỉ xếp hạng thấp).
    const allSpecialTags = TOPICS_Q9.filter(
      (g) => textIncludesAny(clinic.target_groups, g.kw) || textIncludesAny(clinic.description, g.kw)
    );
    const userGroupIdx = Array.isArray(a.q9) ? a.q9 : [];
    const matchedGroups = allSpecialTags.filter((g) => userGroupIdx.some((i) => TOPICS_Q9[i] === g));
    let ageMatch = null;
    if (a.q2 !== undefined && AGE_GROUP_KEYWORDS[a.q2]) {
      const ageInfo = AGE_GROUP_KEYWORDS[a.q2];
      if (textIncludesAny(clinic.target_groups, ageInfo.kw) || textIncludesAny(clinic.description, ageInfo.kw)) {
        ageMatch = ageInfo;
      }
    }
    const targetGroupScore = matchedGroups.length + (ageMatch ? 1 : 0);

    // ----- Tầng 2: Loại hình phòng khám (q6/q7) -----
    const typePref = a.q6 !== undefined ? a.q6 : a.q7;
    const wantedType = typePref !== undefined ? FACILITY_TYPE_OPTS[typePref] : null;
    const type = normType(clinic.clinic_type);
    let typeExactMatch = false;
    if (wantedType && wantedType.vi !== 'Không quan trọng') {
      const wantsPublic = wantedType.vi === 'Công lập';
      typeExactMatch = type === (wantsPublic ? 'public' : 'private');
    }

    // ----- Tầng 3: Dịch vụ thăm khám / chủ đề quan tâm (q8) -----
    // Ưu tiên so khớp CHÍNH XÁC với cột "service" (admin chọn trực
    // tiếp từ multi-select cùng danh sách TOPICS_Q8 trong trang quản
    // trị) — chính xác hơn nhiều so với suy đoán qua từ khoá. Chỉ
    // dùng description/target_groups làm fallback dò từ khoá cho các
    // cơ sở cũ chưa được gắn tag "service".
    const serviceTags = (clinic.service || '')
      .split(/[,;]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const matchedTopics = [];
    (Array.isArray(a.q8) ? a.q8 : []).forEach((i) => {
      const topic = TOPICS_Q8[i];
      if (!topic) return;
      const exactTagMatch = serviceTags.includes(topic.vi.toLowerCase());
      const fuzzyMatch =
        !serviceTags.length &&
        (textIncludesAny(clinic.description, topic.kw) || textIncludesAny(clinic.target_groups, topic.kw));
      if (exactTagMatch || fuzzyMatch) {
        matchedTopics.push(topic);
      }
    });

    const verified = !!(clinic.license_number && clinic.license_number.trim());

    return {
      targetGroupScore,
      matchedGroups,
      allSpecialTags,
      ageMatch,
      typeExactMatch,
      topicScore: matchedTopics.length,
      matchedTopics,
      verified,
    };
  }

  /* ============================================================
     8) SINH VĂN BẢN GIẢI THÍCH (rule-based — có thể thay bằng
        gọi LLM thật ở backend sau này, giữ nguyên input/output)
     ============================================================ */
  function buildExplanation(clinic, evalInfo, distanceKm) {
    const vi = state.lang === 'vi';
    const parts = [];
    const name = clinic.clinic_name;

    if (evalInfo.verified) {
      parts.push(
        vi
          ? `${name} đã được cấp Giấy phép hoạt động chính thức (${clinic.license_number})`
          : `${name} holds an officially issued operating license (${clinic.license_number})`
      );
    } else {
      parts.push(vi ? `${name}` : `${name}`);
    }

    const groupNames = [
      ...evalInfo.matchedGroups,
      ...(evalInfo.ageMatch ? [evalInfo.ageMatch] : []),
    ];
    if (groupNames.length) {
      const names = groupNames.map((g) => (vi ? g.vi : g.en).toLowerCase()).join(', ');
      parts.push(
        vi
          ? `phù hợp với nhóm đối tượng bạn cần: ${names}`
          : `is suited to the group you need support for: ${names}`
      );
    }

    if (evalInfo.typeExactMatch) {
      parts.push(
        vi ? `đúng loại hình cơ sở bạn ưu tiên` : `matches the facility type you preferred`
      );
    }

    if (evalInfo.matchedTopics.length) {
      const names = evalInfo.matchedTopics.map((t) => (vi ? t.vi : t.en).toLowerCase()).join(', ');
      parts.push(
        vi
          ? `có kinh nghiệm với các vấn đề bạn đang quan tâm: ${names}`
          : `has experience with the topics you're concerned about: ${names}`
      );
    }

    if (distanceKm != null) {
      parts.push(
        vi
          ? `cách bạn khoảng ${distanceKm.toFixed(1)} km`
          : `is about ${distanceKm.toFixed(1)} km from you`
      );
    }

    const sentence = parts.join(vi ? ', ' : ', ') + '.';
    return sentence.charAt(0).toUpperCase() + sentence.slice(1);
  }

  /* ============================================================
     9) PIPELINE: lọc theo bán kính + loại hình, rồi SẮP XẾP theo
        3 tầng ưu tiên — KHÔNG dùng điểm số phù hợp (%) nữa.

        Nếu người dùng chọn "Tôi sẵn sàng đi xa để tìm cơ sở phù hợp"
        (q5 === 2): tự động chuyển bán kính về KHÔNG GIỚI HẠN, và
        việc xếp hạng dựa hoàn toàn vào:
          Tầng 1 — Target groups hỗ trợ (nhiều mục khớp hơn xếp trước)
          Tầng 2 — Loại hình phòng khám đúng ý (Công lập/Tư nhân)
          Tầng 3 — Dịch vụ thăm khám / chủ đề quan tâm (q8)
        Khoảng cách chỉ dùng để phân định khi 3 tầng trên bằng nhau.
     ============================================================ */
  function computeMatches() {
    const willingToTravelFar = state.answers.q5 === 2;
    if (willingToTravelFar) {
      // Tự động chuyển bán kính về "Không giới hạn" và đồng bộ lại
      // dropdown để người dùng thấy đúng trạng thái đang áp dụng.
      state.radiusKm = 0;
      const radiusSelect = $('radiusSelect');
      if (radiusSelect) radiusSelect.value = '0';
    }
    const radius = state.radiusKm;

    // Lọc cứng theo loại hình cơ sở nếu người dùng CÓ chọn cụ thể
    // (bỏ qua nếu họ chọn "Không quan trọng")
    const typePref = state.answers.q6 !== undefined ? state.answers.q6 : state.answers.q7;
    const wantedType = typePref !== undefined ? FACILITY_TYPE_OPTS[typePref] : null;
    const strictType = wantedType && wantedType.vi !== 'Không quan trọng' ? wantedType.vi : null;

    const evaluated = state.clinics
      .map((c) => {
        const d = state.refPoint ? haversineKm(state.refPoint, c) : null;
        const e = evaluateClinic(c);
        return { clinic: c, distanceKm: d, ...e };
      })
      .filter((m) => {
        // Lọc bán kính (bỏ qua nếu không giới hạn)
        if (radius && radius !== 0 && m.distanceKm != null && m.distanceKm > radius) return false;
        // Lọc loại hình cơ sở — "Tổ chức cộng đồng" luôn được giữ lại
        // bất kể người dùng chọn Công lập/Tư nhân
        if (strictType) {
          const type = normType(m.clinic.clinic_type);
          if (type !== 'community') {
            const isPublic = type === 'public';
            const wantsPublic = strictType === 'Công lập';
            if (isPublic !== wantsPublic) return false;
          }
        }
        // Lọc target group: nếu cơ sở CÓ gắn tag nhóm đặc biệt (vd
        // "Hỗ trợ Nhân viên Y Tế") và người dùng CÓ chọn nhóm đặc
        // biệt cần hỗ trợ (q9), nhưng không trùng với bất kỳ tag nào
        // của cơ sở đó — loại khỏi danh sách, vì cơ sở này chỉ
        // chuyên biệt cho (những) nhóm khác, không phải nhóm bạn cần.
        // Nếu người dùng KHÔNG chọn nhóm đặc biệt nào, không loại —
        // chỉ đơn giản là cơ sở đó không được ưu tiên ở Tầng 1.
        if (m.allSpecialTags.length > 0 && Array.isArray(state.answers.q9) && state.answers.q9.length > 0) {
          if (m.matchedGroups.length === 0) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Tầng 1 — Target groups hỗ trợ
        if (b.targetGroupScore !== a.targetGroupScore) return b.targetGroupScore - a.targetGroupScore;
        // Tầng 2 — Loại hình phòng khám đúng ý
        if (b.typeExactMatch !== a.typeExactMatch) return (b.typeExactMatch ? 1 : 0) - (a.typeExactMatch ? 1 : 0);
        // Tầng 3 — Dịch vụ thăm khám / chủ đề quan tâm
        if (b.topicScore !== a.topicScore) return b.topicScore - a.topicScore;
        // Cuối cùng — khoảng cách gần hơn xếp trước (nếu xác định được)
        const da = a.distanceKm == null ? Infinity : a.distanceKm;
        const db = b.distanceKm == null ? Infinity : b.distanceKm;
        return da - db;
      });

    state.matches = evaluated;
    state.currentIndex = 0;
  }

  /* ============================================================
     10) RENDER — HEADER / TOOLBAR
     ============================================================ */
  function renderHeader() {
    const vi = state.lang === 'vi';
    const n = state.matches.length;
    $('resultsHeadline').innerHTML = n
      ? (vi
          ? `Tìm thấy <b>${n}</b> cơ sở phù hợp với bạn`
          : `Found <b>${n}</b> facilities that fit you`)
      : (vi ? 'Không tìm thấy cơ sở phù hợp' : 'No matching facilities found');

    $('resultsSub').textContent = vi
      ? 'Vuốt qua từng gợi ý bên dưới hoặc xem trực tiếp vị trí trên bản đồ.'
      : 'Browse through each suggestion below or view its location on the map.';

    $('resultsCount').textContent = vi
      ? `${n} kết quả trong bán kính ${state.radiusKm === 0 ? 'không giới hạn' : state.radiusKm + ' km'}`
      : `${n} results within ${state.radiusKm === 0 ? 'unlimited radius' : state.radiusKm + ' km'}`;

    const banner = $('mockBanner');
    if (banner) banner.classList.toggle('hidden', !state.usingMock);
  }

  /* ============================================================
     11) RENDER — CARD
     ============================================================ */
  function renderCard() {
    const shell = $('resultsCardShell');
    const loading = $('resultsLoading');
    const empty = $('resultsEmpty');
    const card = $('resultsCard');
    loading.classList.add('hidden');

    if (!state.matches.length) {
      empty.classList.remove('hidden');
      card.classList.add('hidden');
      $('resultsProgress').textContent = '0 / 0';
      $('prevClinic').disabled = true;
      $('nextClinic').disabled = true;
      return;
    }
    empty.classList.add('hidden');
    card.classList.remove('hidden');

    const vi = state.lang === 'vi';
    const m = state.matches[state.currentIndex];
    const c = m.clinic;
    const type = normType(c.clinic_type);

    const tag = $('rcTypeTag');
    tag.dataset.type = type;
    tag.textContent = c.clinic_type || (vi ? 'Không rõ' : 'Unknown');

    $('rcName').textContent = c.clinic_name || '—';
    $('rcVerifiedBadge').classList.toggle('hidden', !m.verified);

    $('rcAddress').textContent = c.address || c.old_address || '—';
    $('rcDistance').textContent =
      m.distanceKm != null
        ? (vi ? `Cách bạn ~ ${m.distanceKm.toFixed(1)} km` : `~ ${m.distanceKm.toFixed(1)} km away`)
        : (vi ? 'Không xác định được khoảng cách' : 'Distance unavailable');

    // Chỉ dùng link Google Maps THẬT do admin nhập (cột ggmaps_link) —
    // không tự tạo link. Nếu cơ sở chưa có link, ẩn nút đi.
    const directionsBtn = $('rcDirections');
    const hasDirectionsLink = !!(c.ggmaps_link && c.ggmaps_link.trim());
    directionsBtn.classList.toggle('hidden', !hasDirectionsLink);
    if (hasDirectionsLink) {
      directionsBtn.href = c.ggmaps_link.trim();
    }

    $('rcPhone').textContent = c.phone || '—';
    $('rcHours').textContent = c.operating_hours || '—';
    $('rcPricing').textContent = (c.price && c.price.trim()) || c.pricing || '—';
    const webEl = $('rcWebsite');
    if (c.website) {
      webEl.href = c.website;
      webEl.textContent = c.website.replace(/^https?:\/\//, '');
    } else {
      webEl.removeAttribute('href');
      webEl.textContent = '—';
    }

    $('rcDesc').textContent = c.description || '';

    const chipsWrap = $('rcTargetGroups');
    chipsWrap.innerHTML = '';
    const matchedLabels = new Set(
      [...m.matchedTopics, ...m.matchedGroups].map((x) => (vi ? x.vi : x.en))
    );
    (c.target_groups || '')
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((label) => {
        const chip = document.createElement('span');
        chip.className = 'rc-chip';
        if ([...matchedLabels].some((ml) => label.toLowerCase().includes(ml.toLowerCase().slice(0, 6)))) {
          chip.classList.add('matched');
        }
        chip.textContent = label;
        chipsWrap.appendChild(chip);
      });

    $('rcLicense').innerHTML = m.verified
      ? (vi
          ? `<b>GPHĐ:</b> ${c.license_number}${c.license_issue_date ? ' · cấp ngày ' + c.license_issue_date : ''}`
          : `<b>License:</b> ${c.license_number}${c.license_issue_date ? ' · issued ' + c.license_issue_date : ''}`)
      : (vi ? 'Chưa có thông tin GPHĐ được xác nhận.' : 'No verified license information yet.');

    $('rcAiExplain').textContent = buildExplanation(c, m, m.distanceKm);

    $('resultsProgress').textContent = `${state.currentIndex + 1} / ${state.matches.length}`;
    $('prevClinic').disabled = state.currentIndex === 0;
    $('nextClinic').disabled = state.currentIndex === state.matches.length - 1;

    highlightMarker(c.id);
  }

  /* ============================================================
     12) MAP (Leaflet / OpenStreetMap)
     ============================================================ */
  function initMap() {
    state.map = L.map('resultsMap', { scrollWheelZoom: true }).setView(
      [state.refPoint?.lat || FALLBACK_CENTER.lat, state.refPoint?.lng || FALLBACK_CENTER.lng],
      13
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(state.map);

    if (state.refPoint) {
      L.circleMarker([state.refPoint.lat, state.refPoint.lng], {
        radius: 7,
        color: '#4A3B52',
        fillColor: '#4A3B52',
        fillOpacity: 0.9,
        weight: 2,
      })
        .addTo(state.map)
        .bindPopup(state.lang === 'vi' ? 'Vị trí của bạn' : 'Your location');
    }
  }

  function buildMarkerIcon(clinic, active) {
    const type = normType(clinic.clinic_type);
    const pinClass = type === 'public' ? 'pin-public' : type === 'community' ? 'pin-community' : 'pin-private';
    const verified = !!(clinic.license_number && clinic.license_number.trim());
    const html = `
      <div class="rm-pin ${pinClass} ${active ? 'pin-active' : ''}" style="position:relative;">
        <i class="fa-solid fa-brain rm-pin-icon"></i>
        ${verified ? '<span class="rm-verified-badge"><i class="fa-solid fa-check"></i></span>' : ''}
      </div>`;
    return L.divIcon({ html, className: '', iconSize: [30, 30], iconAnchor: [15, 30] });
  }

  function renderMarkers() {
    Object.values(state.markers).forEach((mk) => state.map.removeLayer(mk));
    state.markers = {};

    state.matches.forEach((m, idx) => {
      const c = m.clinic;
      if (c.latitude == null || c.longitude == null) return;
      const hasDirectionsLink = !!(c.ggmaps_link && c.ggmaps_link.trim());
      const directionsLine = hasDirectionsLink
        ? `<br><a href="${c.ggmaps_link.trim()}" target="_blank" rel="noopener noreferrer">${state.lang === 'vi' ? 'Chỉ đường →' : 'Directions →'}</a>`
        : '';
      const marker = L.marker([c.latitude, c.longitude], { icon: buildMarkerIcon(c, idx === state.currentIndex) })
        .addTo(state.map)
        .bindPopup(
          `<div class="rm-popup"><b>${c.clinic_name}</b><br>${c.address || ''}${directionsLine}</div>`
        );
      marker.on('click', () => {
        state.currentIndex = idx;
        renderCard();
      });
      state.markers[c.id] = marker;
    });
  }

  function highlightMarker(clinicId) {
    Object.entries(state.markers).forEach(([id, marker]) => {
      const c = state.matches.find((m) => String(m.clinic.id) === String(id));
      if (!c) return;
      marker.setIcon(buildMarkerIcon(c.clinic, String(id) === String(clinicId)));
    });
    const active = state.markers[clinicId];
    if (active && state.map) {
      state.map.flyTo(active.getLatLng(), 15, { duration: 0.6 });
      active.openPopup();
    }
  }

  /* ============================================================
     13) NAVIGATION (kiểu Tinder — Quay lại / Đề xuất tiếp theo)
     ============================================================ */
  function goPrev() {
    if (state.currentIndex > 0) {
      state.currentIndex--;
      renderCard();
    }
  }
  function goNext() {
    if (state.currentIndex < state.matches.length - 1) {
      state.currentIndex++;
      renderCard();
    }
  }

  /* ============================================================
     14) LANGUAGE TOGGLE (giống navbar ở index.html)
     ============================================================ */
  function setLang(lang) {
    state.lang = lang;
    document.body.setAttribute('data-lang', lang);
    $('viBtn').classList.toggle('active', lang === 'vi');
    $('enBtn').classList.toggle('active', lang === 'en');
    renderHeader();
    if (state.matches.length) renderCard();
  }

  /* ============================================================
     15) INIT
     ============================================================ */
  async function init() {
    if (!loadWizardData()) return;

    $('backHomeBtn').addEventListener('click', () => (window.location.href = '../app/index.html'));
    $('viBtn').addEventListener('click', () => setLang('vi'));
    $('enBtn').addEventListener('click', () => setLang('en'));
    $('prevClinic').addEventListener('click', goPrev);
    $('nextClinic').addEventListener('click', goNext);

    const radiusSelect = $('radiusSelect');
    const willingToTravelFar = state.answers.q5 === 2;
    if (willingToTravelFar) {
      // Người dùng đã chọn "sẵn sàng đi xa" — bán kính luôn là
      // không giới hạn, khoá dropdown lại để tránh nhầm lẫn.
      radiusSelect.value = '0';
      radiusSelect.disabled = true;
      state.radiusKm = 0;
    } else {
      const q5b = state.answers.q5b;
      const suggested = q5b !== undefined ? MINUTES_TO_KM[q5b] : DEFAULT_RADIUS_KM;
      radiusSelect.value = String(suggested ?? DEFAULT_RADIUS_KM);
      state.radiusKm = Number(radiusSelect.value);
    }
    radiusSelect.addEventListener('change', () => {
      state.radiusKm = Number(radiusSelect.value);
      computeMatches();
      renderHeader();
      renderCard();
      renderMarkers();
    });

    const [refPoint, clinics] = await Promise.all([getReferencePoint(), loadClinics()]);
    state.refPoint = refPoint;
    state.clinics = clinics;

    computeMatches();
    initMap();
    renderMarkers();
    renderHeader();
    renderCard();
  }

  document.addEventListener('DOMContentLoaded', init);
})();