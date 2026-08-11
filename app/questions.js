  const LOCATIONS_API = 'https://provinces.open-api.vn/api/v2/?depth=2';
  const SCOPE_PROVINCE_MATCH = ['Hồ Chí Minh', 'Đồng Nai', 'Hà Nội', 'Đã Nẵng', 'Hải Phòng', 'Huế']; 
  const PROVINCE_EN_NAMES = {
    'Hồ Chí Minh': 'Ho Chi Minh City',
    'Đồng Nai': 'Dong Nai City',
    'Hà Nội': 'Hanoi Capital City',
    'Đà Nẵng': 'Da Nang City',
    'Hải Phòng': 'Hai Phong City',
    'Huế': 'Hue City',
  };
  function wardEnGuess(viName){
    // API không có tên tiếng Anh cho phường/xã -> quy đổi nhẹ để hiển thị bản EN
    if(viName.startsWith('Phường ')) return viName.replace('Phường ', '') + ' Ward';
    if(viName.startsWith('Xã ')) return viName.replace('Xã ', '') + ' Commune';
    if(viName.startsWith('Đặc khu ')) return viName.replace('Đặc khu ', '') + ' Special Zone';
    return viName;
  }

  const locationsState = { status:'idle', provinces:[] }; // status: idle | loading | ready | error

  async function ensureLocationsLoaded(onChange){
    if(locationsState.status === 'loading' || locationsState.status === 'ready') return;
    locationsState.status = 'loading';
    try{
      const res = await fetch(LOCATIONS_API);
      if(!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      locationsState.provinces = data
        .filter(p => SCOPE_PROVINCE_MATCH.some(name => p.name.includes(name)))
        .map(p => {
          const matchKey = SCOPE_PROVINCE_MATCH.find(name => p.name.includes(name));
          return {
            vi: p.name,
            en: PROVINCE_EN_NAMES[matchKey] || p.name,
            wards: (p.wards || []).map(w => ({ vi: w.name, en: wardEnGuess(w.name) })),
          };
        });
      locationsState.status = 'ready';
    } catch(err){
      console.error('Không tải được danh sách phường:', err);
      locationsState.status = 'error';
    }
    onChange();
  }

  const steps = [
    { key:'lang', type:'lang' },
    { key:'q1', type:'single', required:true,
      q:{vi:'Bạn đang cần dịch vụ tham vấn tâm lý cho ai?', en:'Who do you need psychological counseling services for?'},
      options:[
        {vi:'Bản thân', en:'Myself'},
        {vi:'Cho người thân', en:'For a loved one'},
      ]},
    { key:'q1b', type:'text', required:true,
      showIf:a => a.q1 === 1,
      q:{vi:'Mối quan hệ giữa bạn và người cần tham vấn là gì?', en:"What is your relationship with the person who needs counseling?"},
      placeholder:{vi:'Ví dụ: con, vợ/chồng, bạn bè...', en:'e.g. child, spouse, friend...'}},
    { key:'q2', type:'single', required:true,
      q:{vi:'Người cần tham vấn đang ở độ tuổi nào?', en:'What age group is the person who needs counseling in?'},
      grid:true,
      options:[
        {vi:'Dưới 12 tuổi', en:'Under 12'},
        {vi:'12–17 tuổi', en:'12–17'},
        {vi:'18–25 tuổi', en:'18–25'},
        {vi:'26–40 tuổi', en:'26–40'},
        {vi:'41–60 tuổi', en:'41–60'},
        {vi:'Trên 60 tuổi', en:'Over 60'},
      ]},
    { key:'q3', type:'single', required:true,
      q:{vi:'Giới tính của người cần tham vấn là gì?', en:'What is the gender of the person who needs counseling?'},
      options:[
        {vi:'Nam', en:'Male'},
        {vi:'Nữ', en:'Female'},
        {vi:'Phi nhị giới (Non-binary)', en:'Non-binary'},
        {vi:'Khác', en:'Other'},
        {vi:'Không muốn tiết lộ', en:'Prefer not to say'},
      ]},
    { key:'q4', type:'cascade', required:true,
      q:{vi:'Bạn muốn tìm cơ sở tham vấn tâm lý trên địa bàn nào?', en:'Where would you like to find a counseling facility?'},
      hint:{vi:'Chọn Tỉnh/Thành trước, sau đó chọn Phường.', en:'Select a Province/City first, then a Ward.'}},
    { key:'q5', type:'single', required:true,
      q:{vi:'Bạn muốn tìm cơ sở tham vấn nào?', en:'What type of facility are you looking for?'},
      options:[
        {vi:'Công lập', en:'Public'},
        {vi:'Tư nhân', en:'Private'},
        {vi:'Không quan trọng', en:'No preference'},
      ]},
    { key:'q6', type:'multi', required:true,
      q:{vi:'Chủ đề bạn đang quan tâm', en:'Which topics are you concerned about?'},
      hint:{vi:'Có thể chọn nhiều đáp án.', en:'You may select more than one.'},
      grid:true,
      options:[
        {vi:'Lo âu', en:'Anxiety'},
        {vi:'Trầm cảm', en:'Depression'},
        {vi:'Stress', en:'Stress'},
        {vi:'Kiệt sức', en:'Burnout'},
        {vi:'Khủng hoảng cảm xúc', en:'Emotional crisis'},
        {vi:'Mất ngủ', en:'Insomnia'},
        {vi:'Quan hệ gia đình', en:'Family relationships'},
        {vi:'Quan hệ tình cảm', en:'Romantic relationships'},
        {vi:'Hôn nhân', en:'Marriage'},
        {vi:'Nuôi dạy con', en:'Parenting'},
        {vi:'Sang chấn', en:'Trauma'},
        {vi:'ADHD', en:'ADHD'},
        {vi:'Phổ Tự kỷ', en:'Autism Spectrum Disorder'},
        {vi:'Rối loạn ăn uống', en:'Eating disorders'},
        {vi:'Nghiện', en:'Addiction'},
        {vi:'Khó khăn trong học tập', en:'Academic difficulties'},
        {vi:'Khó khăn trong công việc', en:'Work difficulties'},
        {vi:'Khác', en:'Other'},
      ]},
    { key:'q7', type:'multi', required:false,
      q:{vi:'Bạn có thuộc nhóm đối tượng cần được hỗ trợ chuyên biệt không?', en:'Do you belong to a group that needs specialized support?'},
      hint:{vi:'Không bắt buộc trả lời.', en:'Optional.'},
      options:[
        {vi:'Hỗ trợ LGBTQ+', en:'LGBTQ+ support'},
        {vi:'Hỗ trợ người bệnh H.', en:'Support for people living with HIV'},
        {vi:'Hỗ trợ Nhân viên Y Tế', en:'Support for healthcare workers'},
        {vi:'Hỗ trợ nạn nhân nạn buôn bán người', en:'Support for survivors of human trafficking'},
        {vi:'Hỗ trợ nạn nhân bạo lực học đường / bạo lực gia đình', en:'Support for survivors of school or domestic violence'},
        {vi:'Hỗ trợ người mắc bệnh mạn tính', en:'Support for people with chronic illness'},
      ]},
    { key:'done', type:'done' },
  ];