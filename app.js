// 展厅功能：云端 Supabase 数据库同步版
'use strict';
const $ = id => document.getElementById(id);

// 初始化 Supabase 客户端
const supabaseClient = (window.supabase && CONFIG.supabaseUrl && CONFIG.supabaseKey) 
    ? window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey) 
    : null;

let products = [];
let settings = { name: CONFIG.shopName, whatsapp: CONFIG.whatsapp };
let admin = false;
let currentProductId = null;

const icons = { '黄金戒指': '💍', '黄金项链': '📿', '黄金手链': '✨', '黄金耳环': '💎', '黄金颈圈': '🌟', '黄金吊坠': '👑' };
function modal(id) { $(id).classList.add('open'); }
function closeModal(id) { $(id).classList.remove('open'); }
function phone() { return /^[1-9][0-9]{7,14}$/.test(settings.whatsapp || '') ? settings.whatsapp : null; }
function waUrl(msg) { return 'https://wa.me/' + phone() + '?text=' + encodeURIComponent(msg); }

function applySettings() {
    $('brand').innerHTML = esc(settings.name || '金玉珠宝') + '<small>GOLD JEWELRY</small>';
    $('footerBrand').textContent = settings.name || '金玉珠宝';
    let ok = !!phone();
    ['waMain', 'waFloat', 'detailWa'].forEach(id => $(id).classList.toggle('hidden', !ok));
    $('waHint').classList.toggle('hidden', ok);
    if (ok) {
        let url = waUrl('您好，我想了解贵店的珠宝款式：' + settings.name + '.');
        $('waMain').href = url;
        $('waFloat').href = url;
    }
}

function contactProduct(id) {
    let p = products.find(x => x.id === id);
    if (!p || !phone()) return;
    window.open(waUrl('您好，' + settings.name + ',我想咨询以下珠宝款式：\n名称：' + p.name + '\n编号：' + p.code + '\n分类：' + p.category + '\n材质：' + (p.gold || '尚未填写')), '_blank', 'noopener,noreferrer');
}

// 从云端加载数据
async function loadDataFromCloud() {
    if (!supabaseClient) {
        alert('Supabase 未正确配置，请检查 config.js');
        return;
    }
    // 加载商品
    let { data: prodData, error: prodErr } = await supabaseClient.from('products').select('*');
    if (!prodErr && prodData) {
        products = prodData;
    }
    // 加载设置
    let { data: setData, error: setErr } = await supabaseClient.from('settings').select('*');
    if (!setErr && setData) {
        setData.forEach(item => {
            if (item.key === 'shop_settings') settings = item.value;
        });
    }
    applySettings();
    render();
}

function render() {
    let q = $('search').value.toLowerCase().trim(), cat = $('filter').value;
    let list = products.filter(p => p.visible && (!cat || p.category === cat) && [p.name, p.code, p.gold, p.desc].join(' ').toLowerCase().includes(q));
    $('products').innerHTML = list.map(p => `<article class="item"><div class="photo">${p.images?.[0] ? `<img src="${esc(p.images[0])}" alt="${esc(p.name)}">` : `<span class="placeholder">${icons[p.category] || '✦'}</span>`}<span class="status">${esc(p.status)}</span></div><div class="info"><small>${esc(p.category)} · ${esc(p.code)}</small><h3>${esc(p.name)}</h3><p>${esc(p.gold)} · ${esc(p.desc)}</p><div class="actions"><button class="btn alt" onclick="detail('${p.id}')">查看图片</button>${phone() ? `<button class="wa-btn" onclick="contactProduct('${p.id}')">✆ WhatsApp</button>` : ''}</div></div></article>`).join('') || '<p class="empty">没有找到符合条件的款式。</p>';
}

function detail(id) {
    let p = products.find(x => x.id === id);
    if (!p) return;
    currentProductId = id;
    $('detailName').textContent = p.name;
    $('detailMeta').textContent = [p.code, p.category, p.gold, p.status].filter(Boolean).join(' · ');
    $('detailDesc').textContent = p.desc || '';
    $('detailPhoto').classList.toggle('hidden', !p.images?.length);
    if (p.images?.length) $('detailPhoto').src = p.images[0];
    $('thumbs').innerHTML = (p.images || []).map((im, i) => `<img src="${esc(im)}" alt="图片 ${i + 1}" onclick="document.getElementById('detailPhoto').src=this.src">`).join('');
    modal('detailModal');
}

function openAdmin() { modal('adminModal'); if (admin) showAdmin(); }

function adminLogin() {
    if ($('adminPass').value !== CONFIG.adminDemoPassword) {
        alert('管理员密码错误');
        return;
    }
    admin = true;
    showAdmin();
    if ($('adminNavBtn')) $('adminNavBtn').classList.remove('hidden');
}

function showAdmin() {
    $('adminLogin').classList.add('hidden');
    $('adminPanel').classList.remove('hidden');
    $('shopName').value = settings.name || '';
    $('shopWhatsApp').value = settings.whatsapp || '';
    renderAdmin();
}

async function saveSettings() {
    let raw = $('shopWhatsApp').value.replace(/[\s()+.\-]/g, '');
    if (raw && !/^[1-9][0-9]{7,14}$/.test(raw)) { alert('WhatsApp 号码格式不正确'); return; }
    settings = { name: $('shopName').value.trim() || '金玉珠宝', whatsapp: raw };
    
    // 保存到 Supabase 云端
    let { error } = await supabaseClient.from('settings').upsert({ key: 'shop_settings', value: settings });
    if (error) { alert('保存失败：' + error.message); return; }
    
    applySettings();
    render();
    alert('店铺信息已同步至云端！');
}

function renderAdmin() {
    $('adminList').innerHTML = products.map(p => `<div class="adminrow"><div><strong>${esc(p.name)}</strong><div class="muted small">${esc(p.code)} · ${p.visible ? '展示中' : '已隐藏'}</div></div><div><button class="btn alt" onclick="editProduct('${p.id}')">编辑</button> <button class="btn alt" onclick="toggleProduct('${p.id}')">${p.visible ? '隐藏' : '显示'}</button> <button class="btn alt" onclick="deleteProduct('${p.id}')">删除</button></div></div>`).join('') || '<p class="muted">尚未发布任何款式。</p>';
}

function resetForm() {
    ['editId', 'pName', 'pCode', 'pGold', 'pDesc', 'pImages'].forEach(id => $(id).value = '');
    $('pCategory').value = '黄金戒指'; $('pStatus').value = '有现货'; $('pVisible').checked = true;
    $('formTitle').textContent = '发布珠宝款式';
}

function editProduct(id) {
    let p = products.find(x => x.id === id);
    if (!p) return;
    $('editId').value = p.id;
    $('pName').value = p.name; $('pCode').value = p.code; $('pCategory').value = p.category;
    $('pGold').value = p.gold || ''; $('pDesc').value = p.desc || '';
    $('pStatus').value = p.status; $('pVisible').checked = p.visible;
    $('pImages').value = ''; $('formTitle').textContent = '编辑珠宝款式';
    $('formTitle').scrollIntoView({ behavior: 'smooth' });
}

async function toggleProduct(id) {
    let p = products.find(x => x.id === id);
    if (!p) return;
    p.visible = !p.visible;
    await supabaseClient.from('products').upsert(p);
    render(); renderAdmin();
}

async function deleteProduct(id) {
    if (!confirm('确定删除此款式吗？')) return;
    await supabaseClient.from('products').delete().eq('id', id);
    products = products.filter(p => p.id !== id);
    render(); renderAdmin();
}

function imageData(file) {
    return new Promise((resolve, reject) => {
        let img = new Image(), url = URL.createObjectURL(file);
        img.onload = () => {
            let c = document.createElement('canvas'), s = Math.min(1, 800 / Math.max(img.width, img.height));
            c.width = Math.max(1, Math.round(img.width * s)); c.height = Math.max(1, Math.round(img.height * s));
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            URL.revokeObjectURL(url);
            resolve(c.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(Error('图片加载失败')); };
        img.src = url;
    });
}

async function saveProduct() {
    let name = $('pName').value.trim(), code = $('pCode').value.trim();
    if (!name || !code) { alert('请填写款式名称和编号'); return; }
    let old = products.find(p => p.id === $('editId').value), uploaded = [];
    try { uploaded = await Promise.all([...$('pImages').files].slice(0, 5).map(imageData)); } catch { alert('无法读取图片'); return; }
    
    let p = {
        id: old?.id || 'p' + Date.now(),
        name, code,
        category: $('pCategory').value,
        gold: $('pGold').value.trim(),
        desc: $('pDesc').value.trim(),
        status: $('pStatus').value,
        visible: $('pVisible').checked,
        images: uploaded.length ? uploaded : (old?.images || [])
    };

    // 同步写入 Supabase 云端数据库
    let { error } = await supabaseClient.from('products').upsert(p);
    if (error) { alert('保存到云端失败：' + error.message); return; }

    products = old ? products.map(x => x.id === old.id ? p : x) : [p, ...products];
    resetForm();
    render();
    renderAdmin();
    alert('款式已成功同步至云端数据库！');
}

// 🌐 双语切换逻辑
let currentLang = localStorage.getItem('site_lang') || 'zh';
function toggleLanguage() {
    currentLang = currentLang === 'zh' ? 'en' : 'zh';
    localStorage.setItem('site_lang', currentLang);
    applyLanguage();
    render();
}
function applyLanguage() {
    const lang = CONFIG.i18n[currentLang];
    if ($('langToggleBtn')) $('langToggleBtn').textContent = lang.langBtn;
    if ($('search')) $('search').placeholder = lang.searchPlaceholder;
    if ($('filter') && $('filter').options[0]) {
        $('filter').options[0].text = lang.filterAll;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    applyLanguage();
    loadDataFromCloud(); // 页面加载时从云端读取数据
});

document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open')); });
$('year').textContent = new Date().getFullYear();
