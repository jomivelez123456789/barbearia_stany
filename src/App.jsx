import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, addDoc, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { serviceCategories } from './data/services';
import logoStany from './assets/logo_stany.png';
import heroStany from './assets/hero_stany.png';

const App = () => {
  // --- Persistence Logic ---
  const [bookings, setBookings] = useState([]);
  const [categories, setCategories] = useState(serviceCategories);
  const [blockedSlots, setBlockedSlots] = useState([]);
  
  const defaultSlots = [];
  for (let h = 10; h < 18; h++) {
    if (h === 13) continue; 
    defaultSlots.push(`${h}:00`, `${h}:30`);
  }
  defaultSlots.push('18:00');
  
  const defaultSchedule = {
    1: [...defaultSlots], 2: [...defaultSlots], 3: [...defaultSlots],
    4: [...defaultSlots], 5: [...defaultSlots], 6: [...defaultSlots], 0: [] 
  };
  const [weeklySchedule, setWeeklySchedule] = useState(defaultSchedule);

  useEffect(() => {
    // Listen to bookings
    const unsubBookings = onSnapshot(collection(db, 'bookings'), (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });

    // Listen to blockedSlots
    const unsubBlocked = onSnapshot(collection(db, 'blockedSlots'), (snapshot) => {
      setBlockedSlots(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    });

    // Listen to categories
    const unsubCategories = onSnapshot(doc(db, 'config', 'services'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().categories) {
        setCategories(docSnap.data().categories);
      }
    });

    // Listen to schedule
    const unsubSchedule = onSnapshot(doc(db, 'config', 'schedule'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().weekly) {
        setWeeklySchedule(docSnap.data().weekly);
      }
    });

    return () => {
      unsubBookings();
      unsubBlocked();
      unsubCategories();
      unsubSchedule();
    };
  }, []);

  // --- UI & Security State ---
  const [isAdmin, setIsAdmin] = useState(false);
  const [logoClicks, setLogoClicks] = useState(0);
  const [step, setStep] = useState(1);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);
  
  // --- Toast State ---
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  // Admin Funnel State
  const [adminStep, setAdminStep] = useState(1);
  const [showManualForm, setShowManualForm] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showServicesAdmin, setShowServicesAdmin] = useState(false);
  const [showBlockAdmin, setShowBlockAdmin] = useState(false);
  const [showScheduleAdmin, setShowScheduleAdmin] = useState(false);
  const [selectedWeekday, setSelectedWeekday] = useState(1); // 1 = Monday
  const [newTimeInput, setNewTimeInput] = useState('10:00');
  const [blockDateStr, setBlockDateStr] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [draftCategories, setDraftCategories] = useState(categories);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      setDraftCategories(categories);
    }
  }, [categories, hasUnsavedChanges]);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [showUnsavedExitModal, setShowUnsavedExitModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(null); // null means year view
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [adminBooking, setAdminBooking] = useState({
    id: null,
    customer: '',
    phone: '',
    service: null,
    date: { d: null, m: null, y: null },
    time: ''
  });
  const [editingBooking, setEditingBooking] = useState(null);
  const [adminFilterMode, setAdminFilterMode] = useState('all'); // 'all', 'today', 'tomorrow'

  const [booking, setBooking] = useState({
    category: null,
    services: [],
    day: null,
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
    time: null,
    firstName: '',
    lastName: '',
    phone: ''
  });

  // Calendar view state
  const [viewDate, setViewDate] = useState(new Date());
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState(null);

  // --- Hidden Access Trigger ---
  useEffect(() => {
    if (logoClicks >= 5) {
      setShowPinModal(true);
      setLogoClicks(0);
    }
  }, [logoClicks]);

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput === '1706') {
      setIsAdmin(true);
      resetAdminState();
      setShowPinModal(false);
      setPinInput('');
      showToast('Sessão de Dono iniciada', 'success');
    } else {
      showToast('PIN Incorreto', 'error');
      setPinInput('');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setLogoClicks(0), 3000);
    return () => clearTimeout(timer);
  }, [logoClicks]);

  // --- Scroll State for Header ---
  useEffect(() => {
    const handleHeaderScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleHeaderScroll);
    return () => window.removeEventListener('scroll', handleHeaderScroll);
  }, []);

  // --- Scroll Animation ---
  useEffect(() => {
    const handleScroll = () => {
      const reveals = document.querySelectorAll('[data-reveal]');
      reveals.forEach((el) => {
        const windowHeight = window.innerHeight;
        const revealTop = el.getBoundingClientRect().top;
        if (revealTop < windowHeight - 100) el.classList.add('active');
      });
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const resetAdminState = () => {
    resetAdminBooking();
    setShowDashboard(false);
    setShowServicesAdmin(false);
    setShowBlockAdmin(false);
    setShowScheduleAdmin(false);
    setSelectedMonth(null);
    setAdminStep(1);
    setIsMenuOpen(false);
  };

  const navigateTo = (targetId) => {
    if (isAdmin) {
      resetAdminState();
      resetBooking();
      setIsAdmin(false);
    }
    setIsMenuOpen(false);
    setTimeout(() => {
      const el = document.getElementById(targetId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const nextStep = () => setStep(s => Math.min(s + 1, 5));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));
  
  const resetBooking = () => {
    setStep(1);
    setBooking({
      category: null,
      services: [],
      day: null,
      month: new Date().getMonth(),
      year: new Date().getFullYear(),
      time: null,
      firstName: '',
      lastName: '',
      phone: ''
    });
    setViewDate(new Date());
  };

  const resetAdminBooking = () => {
    setAdminStep(1);
    setAdminBooking({
      id: null,
      customer: '',
      phone: '',
      service: null,
      date: { d: null, m: null, y: null },
      time: ''
    });
    setShowManualForm(false);
  };

  const isSlotBooked = (d, m, y, t) => {
    const isBooked = bookings.some(b => b.date.d === d && b.date.m === m && b.date.y === y && b.time === t);
    const isBlocked = blockedSlots.some(b => b.date.d === d && b.date.m === m && b.date.y === y && b.time === t);
    return isBooked || isBlocked;
  };

  const isBookingPast = (b) => {
    if (!b.date || !b.time) return false;
    const bookingDate = new Date(b.date.y, b.date.m, b.date.d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return bookingDate < today;
  };

  const upcomingBookings = bookings.filter(b => !isBookingPast(b));
  const pastBookings = bookings.filter(b => isBookingPast(b));

  const filteredAdminBookings = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${tomorrow.getMonth()}-${tomorrow.getDate()}`;

    let filtered = upcomingBookings;

    if (adminFilterMode === 'today') {
      filtered = upcomingBookings.filter(b => `${b.date.y}-${b.date.m}-${b.date.d}` === todayStr);
    } else if (adminFilterMode === 'tomorrow') {
      filtered = upcomingBookings.filter(b => `${b.date.y}-${b.date.m}-${b.date.d}` === tomorrowStr);
    }

    // Sort chronologically: Year -> Month -> Day -> Time
    return [...filtered].sort((a, b) => {
      if (a.date.y !== b.date.y) return a.date.y - b.date.y;
      if (a.date.m !== b.date.m) return a.date.m - b.date.m;
      if (a.date.d !== b.date.d) return a.date.d - b.date.d;
      
      const [aH, aM] = a.time.split(':').map(Number);
      const [bH, bM] = b.time.split(':').map(Number);
      if (aH !== bH) return aH - bH;
      return aM - bM;
    });
  }, [upcomingBookings, adminFilterMode]);

  const getMonthlyStats = (year) => {
    const stats = Array.from({length: 12}, () => ({ count: 0, revenue: 0 }));
    pastBookings.forEach(b => {
      if (b.date.y === year) {
        stats[b.date.m].count++;
        let priceNum = 0;
        if (typeof b.price === 'number') priceNum = b.price;
        else if (typeof b.price === 'string') priceNum = parseFloat(b.price.replace(',', '.').replace(/[^\d.]/g, '')) || 0;
        stats[b.date.m].revenue += priceNum;
      }
    });
    return stats;
  };

  const getDailyStats = (year, month) => {
    const totalDays = new Date(year, month + 1, 0).getDate();
    const stats = Array(totalDays).fill(0);
    pastBookings.forEach(b => {
      if (b.date.y === year && b.date.m === month) {
        stats[b.date.d - 1]++;
      }
    });
    return stats;
  };

  const generateYAxisLabels = (maxValue) => {
    if (maxValue === 0) return [5, 0];
    if (maxValue <= 5) return Array.from({length: maxValue + 1}, (_, i) => i).reverse();
    let step = 5;
    if (maxValue > 20) step = 10;
    if (maxValue > 50) step = 20;
    const limit = Math.ceil(maxValue / step) * step;
    const labels = [];
    for (let i = limit; i >= 0; i -= step) {
      labels.push(i);
    }
    return labels;
  };

  const getPercentageChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const calculateTotalPrice = (servicesList) => {
    const total = (servicesList || []).reduce((acc, s) => {
      const val = parseFloat(s.price.replace('€', '').replace(',', '.')) || 0;
      return acc + val;
    }, 0);
    return `${total}€`;
  };

  const confirmBooking = async () => {
    if (!booking.firstName || !booking.phone || booking.services.length === 0) {
      showToast('Por favor, preencha todos os campos e selecione pelo menos um serviço.', 'error');
      return;
    }
    const newBooking = {
      service: booking.services.map(s => s.name).join(' + '),
      price: calculateTotalPrice(booking.services),
      date: { d: booking.day, m: booking.month, y: booking.year },
      time: booking.time,
      customer: booking.firstName,
      phone: booking.phone
    };
    await addDoc(collection(db, 'bookings'), newBooking);
    showToast(`Marcação confirmada para o dia ${booking.day}/${booking.month + 1}!`, 'success');
    resetBooking();
  };

  const confirmAdminBooking = async () => {
    if (!adminBooking.service?.name || !adminBooking.date.d || !adminBooking.time) {
      showToast('Por favor, preencha todos os campos.', 'error');
      return;
    }
    const newBooking = {
      service: adminBooking.service ? adminBooking.service.name || adminBooking.service : 'Serviço Manual',
      price: adminBooking.service?.price || '---',
      date: adminBooking.date,
      time: adminBooking.time,
      customer: adminBooking.customer || 'Marcação Manual',
      phone: adminBooking.phone || '---'
    };
    await addDoc(collection(db, 'bookings'), newBooking);
    showToast('Corte manual adicionado com sucesso!', 'success');
    resetAdminBooking();
  };

  const cancelBooking = (id) => {
    setBookingToDelete(id);
  };

  const executeDelete = async () => {
    if (bookingToDelete) {
      await deleteDoc(doc(db, 'bookings', bookingToDelete.toString()));
      showToast('Marcação removida com sucesso.', 'success');
      setBookingToDelete(null);
    }
  };

  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const weekDays = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
  const weekdayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  
  const getTimeSlotsForDate = (d, m, y) => {
    if (d === null || m === null || y === null) return [];
    const date = new Date(y, m, d);
    const dayOfWeek = date.getDay();
    return weeklySchedule[dayOfWeek] || [];
  };

  // --- Restriction Logic ---
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isPastDay = (d, m, y) => {
    const date = new Date(y, m, d);
    return date < today;
  };

  const isPastTimeSlot = (timeStr, d, m, y) => {
    const now = new Date();
    const [hours, minutes] = timeStr.split(':').map(Number);
    const slotDate = new Date(y, m, d, hours, minutes);
    return slotDate < now;
  };

  const isTooFarFuture = (m, y) => {
    const futureLimit = new Date();
    futureLimit.setFullYear(futureLimit.getFullYear() + 1);
    const checkDate = new Date(y, m, 1);
    return checkDate > futureLimit;
  };

  const isMonthInPast = (m, y) => {
    const currentMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);
    const checkDate = new Date(y, m, 1);
    return checkDate < currentMonthDate;
  };

  // Calendar Logic
  const daysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const startDayOfMonth = (month, year) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Adjust to start on Monday
  };

  const renderCalendar = (isAdminView = false, isBlockView = false) => {
    const month = viewDate.getMonth();
    const year = viewDate.getFullYear();
    const totalDays = daysInMonth(month, year);
    const startOffset = startDayOfMonth(month, year);
    const prevMonthDays = daysInMonth(month - 1, year);
    
    const calendarDays = [];
    
    for (let i = startOffset - 1; i >= 0; i--) {
      calendarDays.push(<div key={`prev-${i}`} className="calendar-day empty">{prevMonthDays - i}</div>);
    }
    
    for (let d = 1; d <= totalDays; d++) {
      let isSelected = false;
      if (isBlockView && blockDateStr) {
        const [by, bm, bd] = blockDateStr.split('-').map(Number);
        isSelected = bd === d && (bm - 1) === month && by === year;
      } else if (isAdminView && !isBlockView) {
        isSelected = adminBooking.date.d === d && adminBooking.date.m === month && adminBooking.date.y === year;
      } else if (!isBlockView) {
        isSelected = booking.day === d && booking.month === month && booking.year === year;
      }

      const date = new Date(year, month, d);
      const isSunday = date.getDay() === 0;
      const disabled = ((!isAdminView || isBlockView) && isPastDay(d, month, year)) || isSunday;
      
      calendarDays.push(
        <button 
          key={d} 
          disabled={disabled}
          className={`calendar-day ${isSelected ? 'selected' : ''} ${disabled ? 'past' : ''} ${isSunday ? 'sunday' : ''}`}
          title={isSunday ? 'Fechado ao Domingo' : ''}
          onClick={() => {
            if (!disabled) {
              if (isBlockView) {
                setBlockDateStr(`${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`);
              } else if (isAdminView) {
                setAdminBooking({...adminBooking, date: { d: d, m: month, y: year }});
                setAdminStep(3);
              } else {
                setBooking({...booking, day: d, month: month, year: year});
                nextStep();
              }
            }
          }}
        >
          {d < 10 ? `0${d}` : d}
        </button>
      );
    }

    return calendarDays;
  };

  const handleMonthNav = (dir, isAdminView = false, isBlockView = false) => {
    const newMonth = viewDate.getMonth() + dir;
    const newYear = viewDate.getFullYear();
    if (!isAdminView && !isBlockView && dir < 0 && isMonthInPast(newMonth, newYear)) return;
    if (dir > 0 && isTooFarFuture(newMonth, newYear)) return;
    
    setViewDate(new Date(newYear, newMonth, 1));
  };

  const addCategory = () => {
    const newCat = {
      id: `cat-${Date.now()}`,
      name: 'Nova Categoria',
      services: []
    };
    setDraftCategories([...draftCategories, newCat]);
    setHasUnsavedChanges(true);
  };

  const removeCategory = (catIdx) => {
    setCategoryToDelete(catIdx);
  };

  const addService = (catIdx) => {
    const newCat = [...draftCategories];
    if (!newCat[catIdx].services) newCat[catIdx].services = [];
    newCat[catIdx].services.push({ id: `s-${Date.now()}`, name: 'Novo Serviço', price: '0€' });
    setDraftCategories(newCat);
    setHasUnsavedChanges(true);
  };

  const addPack = (catIdx) => {
    const newCat = [...draftCategories];
    if (!newCat[catIdx].services) newCat[catIdx].services = [];
    newCat[catIdx].services.push({ id: `p-${Date.now()}`, name: 'Novo Pack Promocional', price: '0€', description: '' });
    setDraftCategories(newCat);
    setHasUnsavedChanges(true);
  };

  const removeService = (catIdx, sIdx) => {
    const newCat = [...draftCategories];
    newCat[catIdx].services.splice(sIdx, 1);
    setDraftCategories(newCat);
    setHasUnsavedChanges(true);
  };

  const addTierItem = (catIdx, tIdx) => {
    const newCat = [...draftCategories];
    newCat[catIdx].tiers[tIdx].items.push('Novo Tópico');
    setDraftCategories(newCat);
    setHasUnsavedChanges(true);
  };

  const removeTierItem = (catIdx, tIdx, itemIdx) => {
    const newCat = [...draftCategories];
    newCat[catIdx].tiers[tIdx].items.splice(itemIdx, 1);
    setDraftCategories(newCat);
    setHasUnsavedChanges(true);
  };
  
  const addTier = (catIdx) => {
    const newCat = [...draftCategories];
    if (!newCat[catIdx].tiers) newCat[catIdx].tiers = [];
    newCat[catIdx].tiers.push({ price: '0€', items: ['Novo Tópico'] });
    setDraftCategories(newCat);
    setHasUnsavedChanges(true);
  };

  const removeTier = (catIdx, tIdx) => {
    const newCat = [...draftCategories];
    newCat[catIdx].tiers.splice(tIdx, 1);
    setDraftCategories(newCat);
    setHasUnsavedChanges(true);
  };

  return (
    <div className="app">
      {/* Pre-Header Spacer for non-admin views */}
      {!isAdmin && <div style={{ height: '100px' }}></div>}

      {!isAdmin && (
        <header style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100%', 
          zIndex: 1000, 
          padding: '1.5rem 0',
          background: 'rgba(22, 22, 22, 0.95)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid var(--glass-border)',
          transition: 'all 0.4s ease'
        }}>
          <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            
            <nav className="desktop-nav" style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', paddingRight: '4rem', alignItems: 'center', gap: '2rem' }}>
              <button 
                onClick={() => { if(window.confirm('Deseja ligar para a Stany Barbershop?')) window.location.href='tel:969208378'; }}
                style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--accent)', fontWeight: '700', fontSize: '1rem', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                969 208 378
              </button>
              <ul style={{ display: 'flex', gap: '3rem' }}>
                <li><button onClick={() => navigateTo('home')} className="nav-link" style={{ fontSize: '0.9rem', fontWeight: '700' }}>Início</button></li>
                <li><button onClick={() => navigateTo('services')} className="nav-link" style={{ fontSize: '0.9rem', fontWeight: '700' }}>Ver Serviços</button></li>
              </ul>
            </nav>

            <div 
              className="logo" 
              style={{ 
                height: '80px', 
                cursor: 'pointer', 
                display: 'flex',
                alignItems: 'center',
                zIndex: 1001,
                flexShrink: 0
              }} 
              onClick={() => { setLogoClicks(c => c + 1); if (!isAdmin) navigateTo('home'); }}
            >
              <img 
                src={logoStany} 
                alt="Stany Barbershop" 
                style={{ height: '100%', width: 'auto', objectFit: 'contain' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.innerHTML = '<span style="font-family: var(--font-hero); font-size: 1.8rem; color: var(--primary); letter-spacing: 2px">STANY</span>';
                }}
              />
            </div>

            <nav className="desktop-nav" style={{ flex: 1, display: 'flex', justifyContent: 'flex-start', paddingLeft: '4rem' }}>
              <ul style={{ display: 'flex', gap: '3rem', alignItems: 'center' }}>
                <li><button onClick={() => navigateTo('location')} className="nav-link" style={{ fontSize: '0.9rem', fontWeight: '700' }}>Localização</button></li>
                <li>
                  <button onClick={() => navigateTo('booking')} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.6rem 1.8rem' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>
                    Agendar
                  </button>
                </li>
              </ul>
            </nav>

            <button 
              className="burger-menu" 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              style={{ position: 'absolute', right: '2rem' }}
            >
              <div className={`burger-bar ${isMenuOpen ? 'open' : ''}`}></div>
            </button>
          </div>
        </header>
      )}

      {/* Mobile Nav Overlay */}
      {!isAdmin && (
        <div className={`mobile-nav-overlay ${isMenuOpen ? 'active' : ''}`}>
          <button onClick={() => { setIsMenuOpen(false); navigateTo('home'); }} className="nav-link" style={{ background: 'none', border: 'none' }}>Início</button>
          <button onClick={() => { setIsMenuOpen(false); navigateTo('services'); }} className="nav-link" style={{ background: 'none', border: 'none' }}>Ver Serviços</button>
          <button onClick={() => { setIsMenuOpen(false); navigateTo('location'); }} className="nav-link" style={{ background: 'none', border: 'none' }}>Localização</button>
          <button 
            onClick={() => { setIsMenuOpen(false); navigateTo('booking'); }} 
            className="btn-primary" 
            style={{ marginTop: '2rem', padding: '1rem 3rem', fontSize: '1.2rem' }}
          >
            Agendar Agora
          </button>
        </div>
      )}

      {isAdmin ? (
        /* Admin View Header */
        <section className="admin-view" style={{ minHeight: '100vh', background: 'var(--bg-dark)' }}>
          <div className="admin-header-bar">
            <h2 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--accent)', margin: 0 }}>PAINEL DE GESTÃO</h2>
            <button 
              onClick={() => { if(hasUnsavedChanges) setShowUnsavedExitModal(true); else { resetAdminState(); resetBooking(); setIsAdmin(false); } }} 
              className="btn-outline" 
              style={{ padding: '0.6rem 1.5rem', fontSize: '0.9rem' }}
            >
              Sair do Painel
            </button>
          </div>
          
          <div className="container" style={{ paddingTop: '6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
              <div>
                <h1 style={{ fontSize: 'clamp(2.5rem, 10vw, 4rem)', margin: 0, fontWeight: '900' }}>RESERVAS</h1>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '1.5rem' }}>
                  <button 
                    onClick={() => setAdminFilterMode('today')} 
                    className={adminFilterMode === 'today' ? 'btn-primary' : 'btn-outline'}
                    style={{ padding: '0.4rem 1.2rem', fontSize: '0.8rem' }}
                  >Hoje</button>
                  <button 
                    onClick={() => setAdminFilterMode('tomorrow')} 
                    className={adminFilterMode === 'tomorrow' ? 'btn-primary' : 'btn-outline'}
                    style={{ padding: '0.4rem 1.2rem', fontSize: '0.8rem' }}
                  >Amanhã</button>
                  <button 
                    onClick={() => setAdminFilterMode('all')} 
                    className={adminFilterMode === 'all' ? 'btn-primary' : 'btn-outline'}
                    style={{ padding: '0.4rem 1.2rem', fontSize: '0.8rem' }}
                  >Tudo</button>
                </div>
              </div>
              <button 
                onClick={() => { setShowManualForm(!showManualForm); setAdminStep(1); }}
                className="btn-primary" 
                style={{ padding: '0.8rem 1.5rem', fontSize: '1rem' }}
              >
                {showManualForm ? 'Fechar' : '+ Marcação Manual'}
              </button>
            </div>

            {showManualForm && (
              <div className="glass-card" style={{ padding: '2rem', marginBottom: '3rem', border: '1px solid var(--primary)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                  <h3 style={{ margin: 0, color: 'var(--accent)', fontWeight: '900' }}>Nova Marcação — Passo {adminStep} de 4</h3>
                  {adminStep > 1 && <button onClick={() => setAdminStep(adminStep - 1)} className="btn-back" style={{ marginTop: 0, padding: '0.4rem 1rem' }}>← Voltar atras</button>}
                </div>

                {adminStep === 1 && (
                  <div className="admin-step">
                    <p style={{ marginBottom: '1rem' }}>1. Selecione o Serviço:</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.8rem', paddingRight: '1rem' }}>
                      {categories.flatMap(c => c.services || []).map(s => (
                        <button key={s.id || s.name} className="glass-hover" onClick={() => { setAdminBooking({...adminBooking, service: s}); setAdminStep(2); }} style={{ padding: '0.8rem', border: '1px solid #333', color: 'white', borderRadius: '4px', textAlign: 'left', fontSize: '0.9rem' }}>{s.name}</button>
                      ))}
                      <button className="glass-hover" onClick={() => { setAdminBooking({...adminBooking, service: {name: 'Serviço Manual', price: '---'}}); setAdminStep(2); }} style={{ padding: '0.8rem', border: '1px solid var(--primary)', color: 'var(--primary)', borderRadius: '4px' }}>Outro Serviço</button>
                    </div>
                  </div>
                )}

                {adminStep === 2 && (
                  <div className="admin-step">
                    <p style={{ marginBottom: '1.5rem' }}>2. Escolha o Dia no Calendário:</p>
                    <div className="calendar-container" style={{ maxWidth: '400px', margin: '0 auto' }}>
                      <div className="calendar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <span style={{ fontWeight: 600 }}>{months[viewDate.getMonth()]} {viewDate.getFullYear()}</span>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                          <button onClick={() => handleMonthNav(-1, true)} style={{ color: 'var(--primary)', fontSize: '1.2rem', background: 'none' }}>‹</button>
                          <button onClick={() => handleMonthNav(1, true)} style={{ color: 'var(--primary)', fontSize: '1.2rem', background: 'none' }}>›</button>
                        </div>
                      </div>
                      <div className="calendar-grid">
                        {weekDays.map(wd => <div key={wd} className="calendar-weekday" style={{ fontSize: '0.8rem' }}>{wd}</div>)}
                        {renderCalendar(true)}
                      </div>
                    </div>
                  </div>
                )}

                {adminStep === 3 && (
                  <div className="admin-step">
                    <p style={{ marginBottom: '1.5rem' }}>3. Escolha a Hora:</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.8rem' }}>
                      {getTimeSlotsForDate(adminBooking.date.d, adminBooking.date.m, adminBooking.date.y).map(t => {
                        const booked = isSlotBooked(adminBooking.date.d, adminBooking.date.m, adminBooking.date.y, t);
                        const disabled = booked;
                        
                        return (
                          <button 
                            key={t}
                            disabled={disabled}
                            onClick={() => { if (!disabled) { setAdminBooking({...adminBooking, time: t}); setAdminStep(4); }}}
                            style={{ 
                              padding: '0.6rem', 
                              border: disabled ? '1px solid #333' : '1px solid var(--primary)', 
                              color: disabled ? '#444' : 'var(--primary)',
                              background: disabled ? '#1a1a1a' : 'transparent',
                              borderRadius: '4px',
                              cursor: disabled ? 'not-allowed' : 'pointer',
                              opacity: disabled ? 0.3 : 1
                            }}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {adminStep === 4 && (
                  <div className="admin-step">
                    <p style={{ marginBottom: '1.5rem' }}>4. Dados do Cliente (Opcional):</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                      <input type="text" placeholder="Nome" value={adminBooking.customer} onChange={(e) => setAdminBooking({...adminBooking, customer: e.target.value})} style={{ padding: '0.8rem', background: 'var(--bg-dark)', color: 'white', border: '1px solid #333', borderRadius: '4px' }} />
                      <input type="tel" placeholder="Contacto" value={adminBooking.phone} onChange={(e) => setAdminBooking({...adminBooking, phone: e.target.value})} style={{ padding: '0.8rem', background: 'var(--bg-dark)', color: 'white', border: '1px solid #333', borderRadius: '4px' }} />
                    </div>
                    <div style={{ padding: '1rem', background: 'rgba(212, 175, 55, 0.1)', borderRadius: '8px', marginBottom: '2rem' }}>
                      <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{adminBooking.service?.name}</span>
                      <div style={{ fontSize: '0.9rem' }}>{adminBooking.date.d} {months[adminBooking.date.m]} às {adminBooking.time}</div>
                    </div>
                    <button onClick={confirmAdminBooking} className="btn-primary" style={{ width: '100%' }}>Confirmar Marcação Manual</button>
                  </div>
                )}
              </div>
            )}

            <div className="admin-table-container" style={{ width: '100%', maxWidth: '100vw', maxHeight: '550px', overflowY: 'auto', overflowX: 'hidden', border: '1px solid var(--glass-border)', borderRadius: '12px' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-dark)', zIndex: 10 }}>
                    <tr style={{ borderBottom: '2px solid var(--primary)' }}>
                      <th style={{ padding: '1rem' }}>Cliente</th>
                      <th style={{ padding: '1rem' }}>Contacto</th>
                      <th style={{ padding: '1rem' }}>Serviço</th>
                      <th style={{ padding: '1rem' }}>Data</th>
                      <th style={{ padding: '1rem' }}>Hora</th>
                      <th style={{ padding: '1rem' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAdminBookings.length === 0 ? (
                      <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhuma reserva encontrada.</td></tr>
                    ) : (
                      filteredAdminBookings.map((b, idx) => {
                        const prevBooking = filteredAdminBookings[idx - 1];
                        const showDivider = !prevBooking || 
                          prevBooking.date.d !== b.date.d || 
                          prevBooking.date.m !== b.date.m || 
                          prevBooking.date.y !== b.date.y;

                        const isToday = () => {
                          const now = new Date();
                          return b.date.d === now.getDate() && b.date.m === now.getMonth() && b.date.y === now.getFullYear();
                        };
                        const isTomorrow = () => {
                          const tom = new Date(); tom.setDate(tom.getDate() + 1);
                          return b.date.d === tom.getDate() && b.date.m === tom.getMonth() && b.date.y === tom.getFullYear();
                        };

                        let dayLabel = `${b.date.d} ${months[b.date.m]} ${b.date.y}`;
                        if (isToday()) dayLabel = `Hoje, ${b.date.d} de ${months[b.date.m]}`;
                        else if (isTomorrow()) dayLabel = `Amanhã, ${b.date.d} de ${months[b.date.m]}`;

                        return (
                          <React.Fragment key={b.id}>
                            {showDivider && (
                              <tr className="day-divider">
                                <td colSpan="6" style={{ padding: '1rem', background: 'rgba(212, 163, 115, 0.1)', color: 'var(--accent)', fontWeight: '900', fontSize: '0.9rem', textTransform: 'uppercase' }}>
                                  {dayLabel}
                                </td>
                              </tr>
                            )}
                            <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                              <td style={{ padding: '1rem' }}>{b.customer || '---'}</td>
                              <td style={{ padding: '1rem' }}>{b.phone || '---'}</td>
                              <td style={{ padding: '1rem' }}>{b.service || '---'}</td>
                              <td style={{ padding: '1rem' }}>{b.date?.d ? `${b.date.d} ${months[b.date.m]} ${b.date.y}` : '---'}</td>
                              <td style={{ padding: '1rem' }}>{b.time || '---'}</td>
                              <td style={{ padding: '1rem' }}>
                                <button onClick={() => setEditingBooking(b)} style={{ color: '#aaa', textDecoration: 'underline', marginRight: '1rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: 0 }}>Editar</button>
                                <button onClick={() => cancelBooking(b.id)} style={{ color: '#ff4d4d', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: 0 }}>Cancelar</button>
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Schedule Blocking Dashboard */}
            <div style={{ marginTop: '3rem' }}>
              <button 
                onClick={() => setShowBlockAdmin(!showBlockAdmin)}
                className="btn-primary" 
                style={{ width: '100%', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-dark)', border: '1px solid #ff4d4d', color: '#ff4d4d' }}
              >
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Gestão de Indisponibilidades</span>
                <span style={{ fontSize: '1.5rem' }}>{showBlockAdmin ? '▲' : '▼'}</span>
              </button>
              
              {showBlockAdmin && (
                <div className="glass-card" style={{ marginTop: '1rem', padding: '1.5rem', animation: 'modal-enter 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <p style={{ color: 'var(--text-muted)' }}>Escolha um dia específico para bloquear ou desbloquear horários. Estes horários não aparecerão aos clientes.</p>
                  
                  <div style={{ maxWidth: '400px', margin: '0 auto', width: '100%', background: '#0a0a0a', padding: '1rem', borderRadius: '8px', border: '1px solid #333' }}>
                    <div className="calendar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <button onClick={() => handleMonthNav(-1, false, true)} className="calendar-nav" style={{ background: 'transparent', color: 'var(--primary)', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0.2rem 1rem' }}>&lt;</button>
                      <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'white' }}>{months[viewDate.getMonth()]} {viewDate.getFullYear()}</span>
                      <button onClick={() => handleMonthNav(1, false, true)} className="calendar-nav" style={{ background: 'transparent', color: 'var(--primary)', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0.2rem 1rem' }}>&gt;</button>
                    </div>
                    <div className="calendar-grid">
                      {weekDays.map(d => <div key={d} className="calendar-day-header" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', paddingBottom: '0.5rem', borderBottom: '1px solid #222' }}>{d}</div>)}
                      {renderCalendar(false, true)}
                    </div>
                  </div>
                  
                  {blockDateStr && (() => {
                    const [y, m, d] = blockDateStr.split('-').map(Number);
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.8rem', marginTop: '1rem', paddingBottom: '2rem', borderBottom: '1px dashed var(--glass-border)' }}>
                        {getTimeSlotsForDate(d, m - 1, y).map(t => {
                          const isBooked = bookings.some(b => b.date.d === d && b.date.m === (m - 1) && b.date.y === y && b.time === t);
                          const isBlocked = blockedSlots.some(b => b.date.d === d && b.date.m === (m - 1) && b.date.y === y && b.time === t);
                          const isPast = isPastTimeSlot(t, d, m - 1, y);
                          
                          return (
                            <button 
                              key={t}
                              disabled={isBooked || isPast}
                              onClick={async () => {
                                if (isBlocked) {
                                  const blockedSlot = blockedSlots.find(b => b.date.d === d && b.date.m === (m - 1) && b.date.y === y && b.time === t);
                                  if (blockedSlot) await deleteDoc(doc(db, 'blockedSlots', blockedSlot.id.toString()));
                                  showToast(`${t} desbloqueado.`, 'success');
                                } else if (!isBooked) {
                                  await addDoc(collection(db, 'blockedSlots'), { date: { d, m: m - 1, y }, time: t });
                                  showToast(`${t} bloqueado.`, 'error');
                                }
                              }}
                              style={{ 
                                padding: '0.6rem', 
                                border: (isBooked || isPast) ? '1px solid #333' : (isBlocked ? '1px solid #ff4d4d' : '1px solid var(--glass-border)'), 
                                color: (isBooked || isPast) ? '#444' : (isBlocked ? 'white' : 'var(--text-muted)'),
                                background: (isBooked || isPast) ? '#1a1a1a' : (isBlocked ? '#ff4d4d' : 'transparent'),
                                borderRadius: '4px',
                                cursor: (isBooked || isPast) ? 'not-allowed' : 'pointer',
                                fontWeight: isBlocked ? 'bold' : 'normal'
                              }}
                            >
                              {t}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}

                  <div>
                    <h4 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Horários Bloqueados</h4>
                    {blockedSlots.filter(bs => !isBookingPast(bs)).length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Nenhum horário futuro bloqueado manualmente.</p>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem' }}>
                        {blockedSlots.filter(bs => !isBookingPast(bs)).sort((a,b) => a.date.y - b.date.y || a.date.m - b.date.m || a.date.d - b.date.d || a.time.localeCompare(b.time)).map(bs => (
                          <div key={bs.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#222', padding: '0.5rem 0.8rem', borderRadius: '4px', border: '1px solid #ff4d4d' }}>
                            <span style={{ fontSize: '0.9rem', color: 'white' }}>{bs.date.d} {months[bs.date.m]} {bs.date.y} - {bs.time}</span>
                            <button 
                              onClick={async () => {
                                await deleteDoc(doc(db, 'blockedSlots', bs.id.toString()));
                                showToast('Horário desbloqueado.', 'success');
                              }} 
                              style={{ background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontWeight: 'bold' }}
                            >✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Base Weekly Schedule Management */}
            <div style={{ marginTop: '2rem' }}>
              <button 
                onClick={() => setShowScheduleAdmin(!showScheduleAdmin)}
                className="btn-primary" 
                style={{ width: '100%', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-dark)', border: '1px solid var(--primary)', color: 'var(--primary)' }}
              >
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Gestão de Horários Base (Semanal)</span>
                <span style={{ fontSize: '1.5rem' }}>{showScheduleAdmin ? '▲' : '▼'}</span>
              </button>
              
              {showScheduleAdmin && (
                <div className="glass-card" style={{ marginTop: '1rem', padding: '1.5rem', animation: 'modal-enter 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <p style={{ color: 'var(--text-muted)' }}>Configure aqui os horários disponíveis permanentemente para cada dia da semana. Ao remover um horário aqui, ele deixará de aparecer em todas as semanas futuras para esse dia.</p>
                  
                  <div className="weekday-selector" style={{ marginBottom: '1rem' }}>
                    {[1, 2, 3, 4, 5, 6].map(wdIdx => (
                      <button 
                        key={wdIdx}
                        onClick={() => setSelectedWeekday(wdIdx)}
                        className={`weekday-btn ${selectedWeekday === wdIdx ? 'active' : ''}`}
                        style={{
                          padding: '0.6rem 1rem',
                          borderRadius: '4px',
                          background: selectedWeekday === wdIdx ? 'var(--primary)' : 'transparent',
                          color: selectedWeekday === wdIdx ? 'var(--bg-dark)' : 'var(--primary)',
                          border: '1px solid var(--primary)',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          transition: 'all 0.2s'
                        }}
                      >
                        {weekdayNames[wdIdx].split('-')[0]}
                      </button>
                    ))}
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                    <h4 style={{ color: 'var(--primary)', marginBottom: '1.5rem' }}>Horários Ativos: {weekdayNames[selectedWeekday]}</h4>
                    
                    <div className="schedule-active-slots" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.8rem', marginBottom: '2rem' }}>
                      {weeklySchedule[selectedWeekday]?.sort().map(t => (
                        <div key={t} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#222', padding: '0.6rem', borderRadius: '4px', border: '1px solid var(--glass-border)' }}>
                          <span style={{ fontWeight: 'bold' }}>{t}</span>
                          <button 
                            onClick={async () => {
                              const newSlots = weeklySchedule[selectedWeekday].filter(x => x !== t);
                              const newSchedule = {...weeklySchedule, [selectedWeekday]: newSlots};
                              await setDoc(doc(db, 'config', 'schedule'), { weekly: newSchedule });
                            }}
                            style={{ background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontWeight: 'bold', padding: '0 0.2rem' }}
                          >✕</button>
                        </div>
                      ))}
                    </div>

                    <div className="schedule-add-box" style={{ background: 'rgba(212, 175, 55, 0.05)', padding: '1.5rem', borderRadius: '8px', border: '1px solid rgba(212, 175, 55, 0.2)', marginTop: '1rem' }}>
                      <div className="schedule-add-flex" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <h5 style={{ color: 'var(--primary)', marginBottom: '0.8rem', fontSize: '1rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Adicionar Novo Horário</h5>
                          <div className="schedule-input-group" style={{ display: 'flex', gap: '0.8rem' }}>
                            <input 
                              type="time" 
                              value={newTimeInput}
                              onChange={(e) => setNewTimeInput(e.target.value)}
                              style={{ 
                                flex: 1, 
                                padding: '1rem', 
                                background: '#111', 
                                color: 'white', 
                                border: '1px solid var(--primary)', 
                                borderRadius: '6px',
                                fontSize: '1.1rem',
                                outline: 'none',
                                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)'
                              }}
                            />
                            <button 
                              className="btn-primary"
                              style={{ 
                                padding: '0 2.5rem', 
                                height: 'auto', 
                                fontSize: '1rem', 
                                textTransform: 'uppercase',
                                fontWeight: '800'
                              }}
                              onClick={async () => {
                                if (weeklySchedule[selectedWeekday].includes(newTimeInput)) {
                                  showToast('Este horário já existe!', 'error');
                                  return;
                                }
                                const newSlots = [...weeklySchedule[selectedWeekday], newTimeInput].sort();
                                const newSchedule = {...weeklySchedule, [selectedWeekday]: newSlots};
                                await setDoc(doc(db, 'config', 'schedule'), { weekly: newSchedule });
                                showToast('Novo horário base adicionado!', 'success');
                              }}
                            >
                              + Fixar Horário
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Services Management Dashboard */}
            <div style={{ marginTop: '2rem' }}>
              <button 
                onClick={() => setShowServicesAdmin(!showServicesAdmin)}
                className="btn-primary" 
                style={{ width: '100%', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-dark)', border: '1px solid var(--primary)', color: 'var(--primary)' }}
              >
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Gestão de Serviços & Preços</span>
                <span style={{ fontSize: '1.5rem' }}>{showServicesAdmin ? '▲' : '▼'}</span>
              </button>
              
              {showServicesAdmin && (
                <div className="glass-card" style={{ marginTop: '1rem', padding: '1.5rem', animation: 'modal-enter 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {draftCategories.map((cat, catIdx) => (
                    <div key={cat.id || catIdx} style={{ border: '1px solid var(--glass-border)', padding: '1rem', borderRadius: '6px', background: 'rgba(0,10,0,0.2)', position: 'relative' }}>
                      <button 
                        onClick={() => removeCategory(catIdx)} 
                        style={{ position: 'absolute', top: '1rem', right: '1rem', color: '#ff4d4d', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0.5rem' }}
                        title="Remover Tópico"
                      >✕</button>
                      <input 
                        type="text" 
                        value={cat.name} 
                        onChange={(e) => {
                          const newCat = [...draftCategories];
                          newCat[catIdx].name = e.target.value;
                          setDraftCategories(newCat);
                          setHasUnsavedChanges(true);
                        }}
                        style={{ fontSize: '1.2rem', color: 'var(--primary)', fontWeight: 'bold', background: 'transparent', border: 'none', borderBottom: '1px dashed var(--glass-border)', marginBottom: '1.5rem', width: '80%', padding: '0.2rem' }}
                        placeholder="Nome da Categoria"
                      />
                      
                      {/* Services UI */}
                      {(!cat.tiers) && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.8rem', marginBottom: '1rem' }}>
                          {(cat.services || []).map((s, sIdx) => (
                            <div key={s.id || sIdx} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', background: '#111', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--glass-border)' }}>
                              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-end' }}>
                                <textarea 
                                  value={s.name} 
                                  onChange={(e) => {
                                    const newCat = [...draftCategories];
                                    newCat[catIdx].services[sIdx].name = e.target.value;
                                    setDraftCategories(newCat);
                                    setHasUnsavedChanges(true);
                                  }}
                                  onFocus={(e) => { 
                                    e.target.style.height = '28px'; 
                                    const sh = e.target.scrollHeight; 
                                    e.target.style.height = `${sh}px`; 
                                    e.target.style.overflowY = sh > 56 ? 'auto' : 'hidden'; 
                                  }}
                                  onInput={(e) => { 
                                    e.target.style.height = '28px'; 
                                    const sh = e.target.scrollHeight; 
                                    e.target.style.height = `${sh}px`; 
                                    e.target.style.overflowY = sh > 56 ? 'auto' : 'hidden'; 
                                  }}
                                  style={{ flex: 1, padding: '0.4rem', fontSize: '0.9rem', background: 'transparent', color: 'white', border: 'none', borderBottom: '1px solid #333', resize: 'none', height: '28px', maxHeight: '56px', lineHeight: '1.2', overflowY: 'hidden', fontFamily: 'inherit', boxSizing: 'border-box' }}
                                  placeholder="Serviço"
                                  rows={1}
                                />
                                <input 
                                  type="text" 
                                  value={s.price} 
                                  onChange={(e) => {
                                    const newCat = [...draftCategories];
                                    newCat[catIdx].services[sIdx].price = e.target.value;
                                    setDraftCategories(newCat);
                                    setHasUnsavedChanges(true);
                                  }}
                                  style={{ width: '60px', padding: '0.4rem', fontSize: '0.9rem', background: 'transparent', color: 'var(--primary)', textAlign: 'right', border: 'none', borderBottom: '1px solid #333', height: '28px', boxSizing: 'border-box' }}
                                  placeholder="€"
                                />
                                <button onClick={() => removeService(catIdx, sIdx)} style={{ color: '#ff4d4d', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0.5rem', fontWeight: 'bold' }}>✕</button>
                              </div>
                              {s.description !== undefined && (
                                <textarea 
                                  value={s.description}
                                  onChange={(e) => {
                                    const newCat = [...draftCategories];
                                    newCat[catIdx].services[sIdx].description = e.target.value;
                                    setDraftCategories(newCat);
                                    setHasUnsavedChanges(true);
                                  }}
                                  style={{ width: '100%', padding: '0.6rem', fontSize: '0.85rem', background: '#222', color: 'var(--text-muted)', border: '1px solid var(--glass-border)', borderRadius: '4px', resize: 'vertical', minHeight: '80px', overflowY: 'auto', fontFamily: 'inherit' }}
                                  placeholder="Insira os serviços do pack aqui (ex: Cabelo + Barba)"
                                />
                              )}
                            </div>
                          ))}
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <button onClick={() => addService(catIdx)} style={{ flex: 1, color: '#aaa', background: 'transparent', border: '1px dashed #555', borderRadius: '4px', padding: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', outline: 'none' }}>
                              + Serviço Simples
                            </button>
                            <button onClick={() => addPack(catIdx)} style={{ flex: 1, color: 'var(--primary)', background: 'transparent', border: '1px dashed var(--primary)', borderRadius: '4px', padding: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', outline: 'none' }}>
                              + Serviço/Pack com Descrição
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Tiers UI */}
                      {cat.tiers && (
                        <div style={{ display: 'grid', gap: '1rem' }}>
                          {cat.tiers.map((t, tIdx) => (
                            <div key={tIdx} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#111', padding: '0.8rem', borderRadius: '4px', border: '1px solid var(--glass-border)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <input 
                                  type="text" 
                                  value={t.price} 
                                  onChange={(e) => {
                                    const newCat = [...draftCategories];
                                    newCat[catIdx].tiers[tIdx].price = e.target.value;
                                    setDraftCategories(newCat);
                                    setHasUnsavedChanges(true);
                                  }}
                                  style={{ width: '80px', padding: '0.5rem', fontSize: '0.9rem', background: '#222', color: 'white', border: '1px solid var(--primary)', borderRadius: '4px', textAlign: 'center' }}
                                />
                                <button onClick={() => removeTier(catIdx, tIdx)} style={{ color: '#ff4d4d', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Remover Nível / Preço</button>
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                                {t.items.map((item, itemIdx) => (
                                  <div key={itemIdx} style={{ display: 'flex', alignItems: 'center', background: '#222', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.8rem' }}>
                                    <input 
                                      type="text" 
                                      value={item} 
                                      onChange={(e) => {
                                        const newCat = [...draftCategories];
                                        newCat[catIdx].tiers[tIdx].items[itemIdx] = e.target.value;
                                        setDraftCategories(newCat);
                                        setHasUnsavedChanges(true);
                                      }}
                                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', width: `${Math.max(item.length, 5)}ch` }}
                                    />
                                    <button onClick={() => removeTierItem(catIdx, tIdx, itemIdx)} style={{ color: '#ff4d4d', background: 'none', border: 'none', cursor: 'pointer', marginLeft: '0.2rem' }}>✕</button>
                                  </div>
                                ))}
                                <button onClick={() => addTierItem(catIdx, tIdx)} style={{ color: '#aaa', background: 'transparent', border: '1px dashed #555', borderRadius: '12px', padding: '0.2rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem' }}>+ Adicionar Tópico</button>
                              </div>
                            </div>
                          ))}
                          <button onClick={() => addTier(catIdx)} style={{ color: '#aaa', background: 'transparent', border: '1px dashed #555', borderRadius: '4px', padding: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', width: '200px' }}>
                            + Adicionar Nível
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
                    <button onClick={addCategory} className="btn-back" style={{ margin: 0, border: '1px dashed var(--primary)', color: 'var(--primary)' }}>+ Nova Categoria</button>
                    <button onClick={async () => { await setDoc(doc(db, 'config', 'services'), { categories: draftCategories }); setHasUnsavedChanges(false); showToast('Alterações guardadas com sucesso!', 'success'); }} className="btn-primary" style={{ margin: 0 }}>Guardar Tudo</button>
                  </div>
                </div>
              )}
            </div>

            {/* Past Bookings Dashboard */}
            <div style={{ marginTop: '3rem' }}>
              <button 
                onClick={() => setShowDashboard(!showDashboard)}
                className="btn-primary" 
                style={{ width: '100%', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-dark)', border: '1px solid var(--primary)', color: 'var(--primary)' }}
              >
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Histórico de Cortes & Dashboard</span>
                <span style={{ fontSize: '1.5rem' }}>{showDashboard ? '▲' : '▼'}</span>
              </button>
              
              {showDashboard && (
                <div className="glass-card" style={{ marginTop: '1rem', padding: '2rem', animation: 'modal-enter 0.3s ease-out' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <button onClick={() => setSelectedYear(y => y - 1)} style={{ color: 'var(--primary)', fontSize: '2rem', background: 'none', border: 'none', cursor: 'pointer' }}>‹</button>
                      <h3 style={{ margin: 0, fontSize: '1.5rem', minWidth: '100px', textAlign: 'center' }}>{selectedYear}</h3>
                      <button disabled={selectedYear >= new Date().getFullYear()} onClick={() => setSelectedYear(y => y + 1)} style={{ color: 'var(--primary)', fontSize: '2rem', background: 'none', border: 'none', cursor: selectedYear >= new Date().getFullYear() ? 'not-allowed' : 'pointer', opacity: selectedYear >= new Date().getFullYear() ? 0.2 : 1 }}>›</button>
                    </div>
                    {selectedMonth !== null && (
                      <button onClick={() => setSelectedMonth(null)} className="btn-back" style={{ marginTop: 0, padding: '0.4rem 1rem' }}>
                        Ver Resumo Anual
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingBottom: '1rem', marginBottom: '2rem' }}>
                    {months.map((m, idx) => {
                      const isActive = selectedMonth === idx;
                      const hasData = pastBookings.some(b => b.date.y === selectedYear && b.date.m === idx);
                      const isFutureMonth = selectedYear === new Date().getFullYear() && idx > new Date().getMonth();
                      
                      return (
                        <button 
                          key={m}
                          disabled={isFutureMonth}
                          onClick={() => setSelectedMonth(idx)}
                          style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '50px',
                            background: isActive ? 'var(--primary)' : 'transparent',
                            color: isActive ? 'var(--bg-dark)' : (hasData ? 'var(--primary)' : 'var(--text-muted)'),
                            border: `1px solid ${hasData ? 'var(--primary)' : 'var(--glass-border)'}`,
                            fontWeight: isActive ? 'bold' : 'normal',
                            minWidth: '60px',
                            textAlign: 'center',
                            cursor: isFutureMonth ? 'not-allowed' : 'pointer',
                            opacity: isFutureMonth ? 0.3 : 1
                          }}
                        >
                          {m.substring(0, 3)}
                        </button>
                      );
                    })}
                  </div>

                  {selectedMonth === null ? (
                    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
                        <div>
                          <h4 style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '1.2rem' }}>Total de Marcações ({selectedYear})</h4>
                          <div style={{ fontSize: '4rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                            {getMonthlyStats(selectedYear).reduce((a, b) => a + b.count, 0)}
                          </div>
                        </div>
                        <div>
                          <h4 style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '1.2rem' }}>Faturação Total ({selectedYear})</h4>
                          <div style={{ fontSize: '4rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                            {getMonthlyStats(selectedYear).reduce((a, b) => a + b.revenue, 0).toFixed(2)}€
                          </div>
                        </div>
                      </div>

                      {/* Annual Bar Chart */}
                      <div className="chart-container" style={{ marginTop: '1rem' }}>
                        {(() => {
                          const annualData = getMonthlyStats(selectedYear);
                          const maxAnnual = Math.max(...annualData.map(d => d.count), 0);
                          const yLabels = generateYAxisLabels(maxAnnual);
                          const limit = Math.max(yLabels[0] || 1, 1);
                          return (
                            <>
                              <div className="chart-y-axis">
                                {yLabels.map(l => <span key={l}>{l}</span>)}
                              </div>
                              {annualData.map((data, idx) => {
                                const val = data.count;
                                const percentage = (val / limit) * 100;
                                const isFutureMonth = selectedYear === new Date().getFullYear() && idx > new Date().getMonth();
                                return (
                                  <div 
                                    key={idx} 
                                    className="chart-bar-wrapper"
                                    onClick={() => { if (!isFutureMonth) setSelectedMonth(idx); }}
                                    style={{ cursor: isFutureMonth ? 'default' : 'pointer', opacity: isFutureMonth ? 0.3 : 1 }}
                                  >
                                    {!isFutureMonth && <div className="chart-tooltip">{val} Marc. | {data.revenue.toFixed(2)}€</div>}
                                    <div className="chart-bar" style={{ height: `${percentage}%`, background: val === 0 ? 'transparent' : 'var(--primary)', border: val === 0 ? '1px dashed var(--glass-border)' : 'none' }}></div>
                                    <span className="chart-label">{months[idx].substring(0, 3)}</span>
                                  </div>
                                );
                              })}
                            </>
                          );
                        })()}
                      </div>

                      <p style={{ marginTop: '2rem', color: 'var(--text-main)', fontSize: '1.1rem' }}>Selecione um mês acima para ver os detalhes e gerir cortes.</p>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
                        <div style={{ padding: '2rem', background: 'var(--bg-dark)', borderRadius: '8px', border: '1px solid var(--glass-border)', textAlign: 'center', position: 'relative' }}>
                          <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', fontSize: '1.1rem' }}>Marcações em {months[selectedMonth]}</p>
                          <div style={{ fontSize: '3.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                            {getMonthlyStats(selectedYear)[selectedMonth].count}
                          </div>
                          <div style={{ marginTop: '0.5rem', fontSize: '1rem', fontWeight: 'bold', color: (() => {
                            const current = getMonthlyStats(selectedYear)[selectedMonth].count;
                            const prev = selectedMonth === 0 ? getMonthlyStats(selectedYear - 1)[11].count : getMonthlyStats(selectedYear)[selectedMonth - 1].count;
                            const diff = getPercentageChange(current, prev);
                            return diff > 0 ? '#4caf50' : diff < 0 ? '#ff4d4d' : 'var(--text-muted)';
                          })() }}>
                            {(() => {
                              const current = getMonthlyStats(selectedYear)[selectedMonth].count;
                              const prev = selectedMonth === 0 ? getMonthlyStats(selectedYear - 1)[11].count : getMonthlyStats(selectedYear)[selectedMonth - 1].count;
                              const diff = getPercentageChange(current, prev);
                              return diff > 0 ? `▲ +${diff}%` : diff < 0 ? `▼ ${diff}%` : `0%`;
                            })()}
                          </div>
                        </div>
                        <div style={{ padding: '2rem', background: 'var(--bg-dark)', borderRadius: '8px', border: '1px solid var(--glass-border)', textAlign: 'center', position: 'relative' }}>
                          <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', fontSize: '1.1rem' }}>Faturação em {months[selectedMonth]}</p>
                          <div style={{ fontSize: '3.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                            {getMonthlyStats(selectedYear)[selectedMonth].revenue.toFixed(2)}€
                          </div>
                          <div style={{ marginTop: '0.5rem', fontSize: '1rem', fontWeight: 'bold', color: (() => {
                            const current = getMonthlyStats(selectedYear)[selectedMonth].revenue;
                            const prev = selectedMonth === 0 ? getMonthlyStats(selectedYear - 1)[11].revenue : getMonthlyStats(selectedYear)[selectedMonth - 1].revenue;
                            const diff = getPercentageChange(current, prev);
                            return diff > 0 ? '#4caf50' : diff < 0 ? '#ff4d4d' : 'var(--text-muted)';
                          })() }}>
                            {(() => {
                              const current = getMonthlyStats(selectedYear)[selectedMonth].revenue;
                              const prev = selectedMonth === 0 ? getMonthlyStats(selectedYear - 1)[11].revenue : getMonthlyStats(selectedYear)[selectedMonth - 1].revenue;
                              const diff = getPercentageChange(current, prev);
                              return diff > 0 ? `▲ +${diff}%` : diff < 0 ? `▼ ${diff}%` : `0%`;
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Monthly Bar Chart */}
                      <div className="chart-container" style={{ marginBottom: '3rem' }}>
                        {(() => {
                          const dailyData = getDailyStats(selectedYear, selectedMonth);
                          const maxDaily = Math.max(...dailyData, 0);
                          const yLabels = generateYAxisLabels(maxDaily);
                          const limit = Math.max(yLabels[0] || 1, 1);
                          return (
                            <>
                              <div className="chart-y-axis">
                                {yLabels.map(l => <span key={l}>{l}</span>)}
                              </div>
                              {dailyData.map((val, idx) => {
                                const percentage = (val / limit) * 100;
                                return (
                                  <div key={idx} className="chart-bar-wrapper">
                                    <div className="chart-tooltip">Dia {idx + 1}: {val} Marc.</div>
                                    <div className="chart-bar" style={{ height: `${percentage}%`, background: val === 0 ? 'transparent' : 'var(--primary)', border: val === 0 ? '1px dashed var(--glass-border)' : 'none' }}></div>
                                    <span className="chart-label" style={{ fontSize: '0.7rem' }}>{idx + 1}</span>
                                  </div>
                                );
                              })}
                            </>
                          );
                        })()}
                      </div>

                      <div style={{ overflowX: 'auto', background: 'var(--bg-dark)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--primary)', background: 'rgba(212, 175, 55, 0.05)' }}>
                              <th style={{ padding: '1rem' }}>Data & Hora</th>
                              <th style={{ padding: '1rem' }}>Cliente (Contacto)</th>
                              <th style={{ padding: '1rem' }}>Serviço (Preço)</th>
                              <th style={{ padding: '1rem' }}>Acão</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pastBookings.filter(b => b.date.y === selectedYear && b.date.m === selectedMonth).length === 0 ? (
                              <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum corte registado neste mês.</td></tr>
                            ) : (
                              pastBookings
                                .filter(b => b.date.y === selectedYear && b.date.m === selectedMonth)
                                .sort((a,b) => {
                                  if (b.date.d !== a.date.d) return b.date.d - a.date.d;
                                  return b.time.localeCompare(a.time);
                                })
                                .map(b => (
                                  <tr key={b.id} style={{ borderBottom: '1px solid var(--glass-border)', transition: 'background 0.2s' }}>
                                    <td style={{ padding: '1rem' }}>
                                      <strong style={{ color: 'white' }}>{b.date.d} {months[b.date.m]}</strong> <br/>
                                      <span style={{ color: 'var(--text-muted)' }}>às {b.time}</span>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                      <strong style={{ color: 'white' }}>{b.customer}</strong> <br/>
                                      <span style={{ color: 'var(--text-muted)' }}>{b.phone}</span>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                      <span style={{ color: 'var(--primary)' }}>{b.service}</span> <br/>
                                      <span style={{ color: 'var(--text-muted)' }}>{b.price}</span>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                      <button 
                                        onClick={() => setEditingBooking(b)} 
                                        style={{ color: '#aaa', padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid #555', cursor: 'pointer', marginRight: '0.5rem', background: 'transparent' }}
                                      >
                                        Editar
                                      </button>
                                      <button 
                                        onClick={() => cancelBooking(b.id)} 
                                        style={{ color: '#ff4d4d', background: 'rgba(255, 77, 77, 0.1)', padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid rgba(255, 77, 77, 0.3)', cursor: 'pointer' }}
                                      >
                                        ✗ Anular
                                      </button>
                                    </td>
                                  </tr>
                                ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Edit Booking Modal */}
            {editingBooking && (
              <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="glass-card" style={{ padding: '2rem', width: '90%', maxWidth: '500px', animation: 'modal-enter 0.3s ease-out', border: '1px solid var(--primary)' }}>
                  <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--primary)' }}>Editar Marcação</h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>Cliente:</label>
                      <input type="text" value={editingBooking.customer} onChange={e => setEditingBooking({...editingBooking, customer: e.target.value})} style={{ width: '100%', padding: '0.8rem', background: '#111', color: 'white', border: '1px solid var(--glass-border)', borderRadius: '4px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>Contacto:</label>
                      <input type="text" value={editingBooking.phone} onChange={e => setEditingBooking({...editingBooking, phone: e.target.value})} style={{ width: '100%', padding: '0.8rem', background: '#111', color: 'white', border: '1px solid var(--glass-border)', borderRadius: '4px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>Serviço:</label>
                      <input type="text" value={editingBooking.service} onChange={e => setEditingBooking({...editingBooking, service: e.target.value})} style={{ width: '100%', padding: '0.8rem', background: '#111', color: 'white', border: '1px solid var(--glass-border)', borderRadius: '4px' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <div style={{ flex: 1.5 }}>
                        <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>Data (DD/MM/AAAA):</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input type="number" value={editingBooking.date.d} onChange={e => setEditingBooking({...editingBooking, date: {...editingBooking.date, d: parseInt(e.target.value)}})} style={{ width: '100%', padding: '0.8rem', background: '#111', color: 'white', border: '1px solid var(--glass-border)', borderRadius: '4px', textAlign: 'center' }} min="1" max="31" />
                          <input type="number" value={editingBooking.date.m + 1} onChange={e => setEditingBooking({...editingBooking, date: {...editingBooking.date, m: parseInt(e.target.value) - 1}})} style={{ width: '100%', padding: '0.8rem', background: '#111', color: 'white', border: '1px solid var(--glass-border)', borderRadius: '4px', textAlign: 'center' }} min="1" max="12" />
                          <input type="number" value={editingBooking.date.y} onChange={e => setEditingBooking({...editingBooking, date: {...editingBooking.date, y: parseInt(e.target.value)}})} style={{ width: '100%', padding: '0.8rem', background: '#111', color: 'white', border: '1px solid var(--glass-border)', borderRadius: '4px', textAlign: 'center' }} />
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>Hora (HH:MM):</label>
                        <input type="time" value={editingBooking.time} onChange={e => setEditingBooking({...editingBooking, time: e.target.value})} style={{ width: '100%', padding: '0.8rem', background: '#111', color: 'white', border: '1px solid var(--glass-border)', borderRadius: '4px' }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>Preço (€):</label>
                      <input type="text" value={editingBooking.price} onChange={e => setEditingBooking({...editingBooking, price: e.target.value})} style={{ width: '100%', padding: '0.8rem', background: '#111', color: 'white', border: '1px solid var(--glass-border)', borderRadius: '4px' }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                    <button onClick={() => setEditingBooking(null)} className="btn-back" style={{ flex: 1, margin: 0 }}>Cancelar</button>
                    <button onClick={async () => {
                      const { id, ...updateData } = editingBooking;
                      await updateDoc(doc(db, 'bookings', id.toString()), updateData);
                      setEditingBooking(null);
                      showToast('Marcação atualizada com sucesso!', 'success');
                    }} className="btn-primary" style={{ flex: 1 }}>Guardar Alterações</button>
                  </div>
                </div>
              </div>
            )}

            <button onClick={() => { resetAdminState(); resetBooking(); setIsAdmin(false); }} style={{ marginTop: '2rem', color: 'var(--primary)', background: 'none', border: '1px solid var(--primary)', padding: '0.8rem 1.5rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>← Voltar ao Site</button>
          </div>
        </section>
      ) : (
        /* Main Site Content */
        <>
          {/* Hero Split Layout */}
          <section id="home" style={{ minHeight: '100vh', display: 'flex', alignItems: 'stretch' }}>
            <div className="hero-left-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'var(--bg-dark)' }}>
              <div data-reveal style={{ position: 'relative' }}>
                <h1 style={{ fontSize: '4.5rem', lineHeight: '0.9', marginBottom: '2rem', color: 'var(--accent)', fontWeight: '900' }}>ESTILO &<br/>ALMA.</h1>
                <h2 style={{ fontSize: '1.4rem', color: 'var(--text-main)', marginBottom: '3rem', fontWeight: '600', letterSpacing: '2px' }}>Excelência em cada detalhe.</h2>
                <p style={{ color: 'var(--text-muted)', maxWidth: '500px', marginBottom: '4rem', fontSize: '1.2rem', borderLeft: '3px solid var(--accent)', paddingLeft: '1.5rem', lineHeight: '1.8' }}>
                  Descubra um refúgio de bem-estar onde a tradição da barbearia se encontra com o design moderno. Localizados em Carnide, cuidamos da sua imagem com mestria.
                </p>
                <div style={{ display: 'flex', gap: '2rem' }}>
                  <button onClick={() => navigateTo('booking')} className="btn-primary">Marcar Agora</button>
                  <button onClick={() => navigateTo('services')} className="btn-outline">Ver Serviços</button>
                </div>
              </div>
            </div>
            <div className="hero-right-image" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: `linear-gradient(90deg, var(--bg-dark), rgba(22, 22, 22, 0.4)), url(${heroStany})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
              {/* Decorative Corner Marks */}
              <div style={{ position: 'absolute', top: '50px', right: '50px', width: '100px', height: '100px', borderTop: '2px solid var(--primary)', borderRight: '2px solid var(--primary)', opacity: 0.3 }}></div>
              <div style={{ position: 'absolute', bottom: '50px', left: '50px', width: '100px', height: '100px', borderBottom: '2px solid var(--primary)', borderLeft: '2px solid var(--primary)', opacity: 0.3 }}></div>
            </div>
          </section>

          {/* Services List - Warm Industrial Style */}
          <section id="services" className="section-padding" style={{ background: 'var(--bg-dark)', position: 'relative', padding: '12rem 0' }}>
            <div className="container">
              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '8rem' }}>
                <h2 style={{ fontSize: '4rem', margin: 0, fontWeight: '900' }} data-reveal>Catálogo de Serviços</h2>
                <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }}></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '4rem' }}>
                {categories.map((cat, catIdx) => (
                  <div key={cat.id} className="service-box" data-reveal>
                    <h3 style={{ fontSize: '1.4rem', color: 'var(--accent)', marginBottom: '3rem', display: 'flex', alignItems: 'center', gap: '1rem', fontWeight: '900' }}>
                      {cat.name}
                    </h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {cat.services?.map((s, sIdx) => (
                        <div key={s.id || s.name} className="service-item">
                          <span style={{ fontWeight: '600', letterSpacing: '1px' }}>{s.name}</span>
                          <div className="service-dots"></div>
                          <span>{s.price}</span>
                        </div>
                      ))}
                      
                      {cat.tiers?.map(tier => (
                        <div key={tier.price} style={{ marginTop: '1.5rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
                          <span style={{ fontSize: '0.9rem', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '1rem', display: 'block', fontWeight: '800' }}>OPÇÕES DE COR / {tier.price}:</span>
                          {tier.items.map(item => (
                            <div key={item} className="service-item" style={{ marginBottom: '0.5rem', opacity: 0.8 }}>
                              <span style={{ fontSize: '1.2rem' }}>{item}</span>
                              <div className="service-dots"></div>
                              <span>{tier.price}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Location & Contact - Warm Industrial Style */}
          <section id="location" className="section-padding" style={{ background: '#1a1a1a', padding: '12rem 0' }}>
            <div className="container">
              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '8rem' }}>
                <h2 style={{ fontSize: '4rem', margin: 0, fontWeight: '900' }} data-reveal>Localização</h2>
                <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }}></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '4rem' }}>
                <div className="blueprint-card" data-reveal style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <h3 style={{ fontSize: '1.4rem', color: 'var(--accent)', marginBottom: '3rem', fontWeight: '900' }}>VISITE-NOS EM CARNIDE</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                    <div>
                      <span style={{ opacity: 0.5, fontSize: '0.9rem', display: 'block', marginBottom: '0.8rem', fontWeight: '700' }}>MORADA</span>
                      <p style={{ fontSize: '1.4rem', lineHeight: '1.5', color: 'white' }}>Tv. Pregoeiro 20A, Carnide<br/>1600-534 Lisboa</p>
                    </div>
                    <div>
                      <span style={{ opacity: 0.5, fontSize: '0.9rem', display: 'block', marginBottom: '0.8rem', fontWeight: '700' }}>TELEFONE</span>
                      <a href="tel:969208378" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '1rem', padding: '1.2rem 2rem', fontSize: '1.5rem' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        Ligar Agora
                      </a>
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem', borderTop: '1px solid var(--glass-border)', paddingTop: '2.5rem' }}>
                      <a href="https://www.instagram.com/stany_barber/" target="_blank" rel="noopener noreferrer" className="nav-link" style={{ fontSize: '1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                        INSTAGRAM
                      </a>
                    </div>
                  </div>
                </div>

                <div className="blueprint-card" data-reveal style={{ position: 'relative', overflow: 'hidden', minHeight: '650px', display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ fontSize: '1.4rem', color: 'var(--accent)', marginBottom: '1.5rem', fontWeight: '900' }}>MAPA & DIREÇÕES</h3>
                  <p style={{ color: 'var(--text-main)', marginBottom: '2rem', fontSize: '1.1rem' }}>
                    Visite-nos no coração histórico de Carnide.
                  </p>
                  <div className="map-embed-container" style={{ flex: 1 }}>
                    <iframe 
                      src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3111.1402026209676!2d-9.187371899999999!3d38.7604882!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xd1932d28bec1c71%3A0xfe5f2f22e324e61a!2sTv.%20Pregoeiro%2020A%2C%201600-534%20Lisboa!5e0!3m2!1spt-PT!2spt!4v1774702923688!5m2!1spt-PT!2spt" 
                      width="100%" 
                      height="100%" 
                      style={{ border: 0 }} 
                      allowFullScreen="" 
                      loading="lazy"
                    ></iframe>
                  </div>
                  <a 
                    href="https://www.google.com/maps/dir//Travessa+do+Pregoeiro+20A,+1600-534+Lisboa" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn-primary" 
                    style={{ marginTop: '1.5rem', width: '100%', textAlign: 'center', justifyContent: 'center' }}
                  >
                    COMO CHEGAR (GPS)
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* Booking Funnel - Warm Style */}
          <section id="booking" className="section-padding" style={{ background: '#080808', padding: '12rem 0' }}>
            <div className="container">
              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '8rem' }}>
                <h2 style={{ fontSize: '4rem', margin: 0, fontWeight: '900' }} data-reveal>Marque a sua Visita</h2>
                <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }}></div>
              </div>

              <div className="blueprint-card" style={{ maxWidth: '900px', margin: '0 auto', borderTop: '4px solid var(--accent)' }} data-reveal>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3rem', fontSize: '0.85rem', fontWeight: '600' }}>
                  <span style={{ color: 'var(--accent)' }}>STANY BARBERSHOP // MARCAÇÃO</span>
                  <span style={{ opacity: 0.5 }}>PASSO {step} DE 5</span>
                </div>

                <div style={{ padding: '3rem' }}>
                  {step === 1 && (
                    <div className="step-content">
                      <h3 style={{ marginBottom: '2.5rem', fontSize: '1.5rem', fontWeight: '800' }}>Escolha a Categoria</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        {categories.map(cat => (
                          <button key={cat.id} className="btn-outline" onClick={() => { setBooking({...booking, category: cat}); nextStep(); }} style={{ padding: '2.5rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '40px', height: '40px', background: 'rgba(212, 163, 115, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                            </div>
                            <span style={{ fontSize: '1.1rem' }}>{cat.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div className="step-content">
                      <h3 style={{ marginBottom: '2.5rem', fontSize: '1.5rem', fontWeight: '800' }}>Selecione o Serviço</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                        {booking.category?.services?.map(s => (
                          <button key={s.id || s.name} className="service-item btn-outline" onClick={() => { setBooking({...booking, services: [s]}); nextStep(); }} style={{ padding: '1.2rem 1.5rem', width: '100%', justifyContent: 'space-between' }}>
                            <span style={{ letterSpacing: '0.5px', fontSize: '1.1rem' }}>{s.name}</span>
                            <div className="service-dots" style={{ opacity: 0.2 }}></div>
                            <span style={{ fontWeight: '800', color: 'var(--accent)' }}>{s.price}</span>
                          </button>
                        ))}
                      </div>
                      <button onClick={prevStep} className="btn-back">← Voltar atrás</button>
                    </div>
                  )}

                  {step === 3 && (
                    <div className="step-content">
                      <div className="calendar-container">
                        <div className="calendar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                          <h3 style={{ margin: 0 }}>{months[viewDate.getMonth()]} {viewDate.getFullYear()}</h3>
                          <div style={{ display: 'flex', gap: '1rem' }}>
                            <button 
                              onClick={() => handleMonthNav(-1)} 
                              style={{ color: 'var(--primary)', fontSize: '1.5rem', opacity: isMonthInPast(viewDate.getMonth() - 1, viewDate.getFullYear()) ? 0.2 : 1, cursor: isMonthInPast(viewDate.getMonth() - 1, viewDate.getFullYear()) ? 'not-allowed' : 'pointer' }}
                            >‹</button>
                            <button 
                              onClick={() => handleMonthNav(1)} 
                              style={{ color: 'var(--primary)', fontSize: '1.5rem', opacity: isTooFarFuture(viewDate.getMonth() + 1, viewDate.getFullYear()) ? 0.2 : 1, cursor: isTooFarFuture(viewDate.getMonth() + 1, viewDate.getFullYear()) ? 'not-allowed' : 'pointer' }}
                            >›</button>
                          </div>
                        </div>
                        <div className="calendar-grid">
                          {weekDays.map(wd => <div key={wd} className="calendar-weekday">{wd}</div>)}
                          {renderCalendar()}
                        </div>
                      </div>
                      <button onClick={prevStep} className="btn-back">← Voltar</button>
                    </div>
                  )}

                  {step === 4 && (
                    <div className="step-content">
                      <h3 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '800' }}>Escolha a Hora</h3>
                      <p style={{ marginBottom: '2.5rem', color: 'var(--text-main)', fontSize: '1.1rem' }}>Horário disponível para {booking.day} de {months[booking.month]} de {booking.year}</p>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                        {getTimeSlotsForDate(booking.day, booking.month, booking.year).map(t => {
                          const booked = isSlotBooked(booking.day, booking.month, booking.year, t);
                          const isPast = isPastTimeSlot(t, booking.day, booking.month, booking.year);
                          const disabled = booked || isPast;
                          
                          return (
                            <button 
                              key={t}
                              disabled={disabled}
                              onClick={() => { if (!disabled) { setBooking({...booking, time: t}); nextStep(); }}}
                              style={{ 
                                padding: '0.8rem', 
                                border: disabled ? '1px solid #333' : '1px solid var(--primary)', 
                                color: disabled ? '#444' : 'var(--primary)',
                                background: disabled ? '#1a1a1a' : 'transparent',
                                borderRadius: '4px',
                                cursor: disabled ? 'not-allowed' : 'pointer',
                                opacity: disabled ? 0.3 : 1
                              }}
                            >
                              {t}
                            </button>
                          );
                        })}
                      </div>
                      <button onClick={prevStep} className="btn-back">← Voltar</button>
                    </div>
                  )}

                  {step === 5 && (
                    <div className="step-content">
                      <h3 style={{ marginBottom: '2.5rem', fontSize: '1.5rem', fontWeight: '800' }}>Finalizar Marcação</h3>
                      <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '2rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.8rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>O seu Nome</label>
                            <input 
                              type="text" 
                              required 
                              placeholder="ex: João Silva"
                              value={booking.firstName}
                              onChange={(e) => setBooking({...booking, firstName: e.target.value})}
                              style={{ width: '100%', padding: '1.2rem', background: '#111', color: 'white', border: '1px solid var(--glass-border)', borderRadius: '12px' }} 
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.8rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Telemóvel / Email</label>
                            <input 
                              type="text" 
                              required 
                              placeholder="ex: 9xx xxx xxx ou xxxxx@gmail.com"
                              value={booking.phone}
                              onChange={(e) => setBooking({...booking, phone: e.target.value})}
                              style={{ width: '100%', padding: '1.2rem', background: '#111', color: 'white', border: '1px solid var(--glass-border)', borderRadius: '12px' }} 
                            />
                          </div>
                        </div>
                        
                        <div style={{ background: 'rgba(212, 163, 115, 0.05)', border: '1px solid rgba(212, 163, 115, 0.2)', borderRadius: '16px', marginBottom: '2rem', overflow: 'hidden' }}>
                          <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid rgba(212, 163, 115, 0.1)', background: 'rgba(212, 163, 115, 0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.6 }}>Serviços Escolhidos</span>
                            <span style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--accent)' }}>{booking.day} {months[booking.month]}, {booking.time}</span>
                          </div>
                          <div style={{ padding: '1.5rem 2rem' }}>
                            {booking.services.map((s, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: idx === booking.services.length - 1 ? 0 : '1rem' }}>
                                <div>
                                  <strong style={{ display: 'block', fontSize: '1.1rem', color: 'white' }}>{s.name}</strong>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                  <span style={{ fontWeight: '700', color: 'var(--accent)' }}>{s.price}</span>
                                  {booking.services.length > 1 && (
                                    <button 
                                      onClick={() => setBooking({...booking, services: booking.services.filter((_, i) => i !== idx)})}
                                      style={{ background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontSize: '1.2rem', padding: '0.2rem' }}
                                      title="Remover serviço"
                                    >✗</button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          {showServicePicker ? (
                            <div style={{ padding: '1rem 2rem', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(212, 163, 115, 0.2)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>Escolha o serviço extra:</span>
                                <button onClick={() => setShowServicePicker(false)} style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textDecoration: 'underline' }}>Fechar</button>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                                {categories.flatMap(c => c.services).map(s => {
                                  const isSelected = booking.services.some(curr => curr.id === s.id);
                                  return (
                                    <button 
                                      key={s.id}
                                      disabled={isSelected}
                                      onClick={() => {
                                        setBooking({...booking, services: [...booking.services, s]});
                                        setShowServicePicker(false);
                                      }}
                                      style={{ 
                                        padding: '0.6rem', 
                                        textAlign: 'left', 
                                        fontSize: '0.8rem', 
                                        background: isSelected ? 'rgba(255,255,255,0.05)' : 'rgba(212, 163, 115, 0.1)',
                                        border: '1px solid rgba(212, 163, 115, 0.2)',
                                        borderRadius: '8px',
                                        color: isSelected ? 'rgba(255,255,255,0.2)' : 'white',
                                        cursor: isSelected ? 'default' : 'pointer',
                                        display: 'flex',
                                        justifyContent: 'space-between'
                                      }}
                                    >
                                      <span>{s.name}</span>
                                      <span style={{ color: 'var(--accent)', fontWeight: '700' }}>{s.price}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div style={{ padding: '0.6rem 2rem', textAlign: 'center', borderTop: '1px solid rgba(212, 163, 115, 0.1)', background: 'rgba(212, 163, 115, 0.05)' }}>
                              <button 
                                onClick={() => setShowServicePicker(true)}
                                style={{ color: 'var(--accent)', fontWeight: '700', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: '0 auto' }}
                              >
                                <span style={{ fontSize: '1.1rem' }}>+</span> Adicionar serviço
                              </button>
                            </div>
                          )}
                        </div>

                        <button onClick={confirmBooking} className="btn-primary" style={{ width: '100%', padding: '1.2rem' }}>Confirmar Reserva</button>
                        <p style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: '1.6' }}>
                          Nota: Para alterar ou desmarcar a sua reserva, por favor contacte-nos através do telemóvel <strong>969 208 378</strong>.
                        </p>
                      </div>
                      <button onClick={prevStep} className="btn-back">← Voltar atrás</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Floating Booking Button - Warmer style */}
      {!isAdmin && (
        <button 
          onClick={() => navigateTo('booking')} 
          className="fab-booking"
          style={{ borderRadius: '16px', background: 'var(--accent)', boxShadow: '0 8px 25px rgba(212, 163, 115, 0.4)' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>
          <span className="fab-text" style={{ fontSize: '0.9rem', fontWeight: '900', color: 'black' }}>Agendar Agora</span>
        </button>
      )}

      {/* Modern Toast Notification */}
      {toast.show && (
        <div className={`toast-container toast-${toast.type}`}>
          <div className="toast-icon">
            {toast.type === 'success' ? '✓' : '⚠'}
          </div>
          <div>{toast.message}</div>
        </div>
      )}

      {/* Footer - Warm Industrial Style */}
      <footer style={{ padding: '6rem 0', background: '#050505', borderTop: '1px solid var(--glass-border)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '4rem', marginBottom: '4rem' }}>
            <div>
              <h3 style={{ color: 'var(--accent)', fontSize: '1.2rem', marginBottom: '1.5rem' }}>Stany Barbershop</h3>
              <p style={{ color: 'var(--text-muted)', lineHeight: '1.8' }}>Excelência em barbearia clássica e moderna no coração de Carnide. O seu estilo é a nossa prioridade.</p>
            </div>
            <div>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '1.2rem', letterSpacing: '1px' }}>HORÁRIO</h4>
              <p style={{ color: 'var(--text-muted)' }}>Segunda a Sábado: 10:00 – 19:00</p>
              <p style={{ color: 'var(--accent)', fontWeight: '700' }}>Domingo: Encerrado</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'monospace', fontSize: '1.5rem', fontWeight: '900', color: 'var(--accent)', opacity: 0.3, marginBottom: '0.5rem' }}>STANY</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>© 2024 Crafted for Excellence</p>
            </div>
          </div>
        </div>
      </footer>

      {/* PIN Modal */}
      {showPinModal && (
        <div className="modal-overlay">
          <div className="glass-card modal-content">
            <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Acesso Reservado</h3>
            <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>Insira o PIN de acesso (Proprietário):</p>
            <form onSubmit={handlePinSubmit}>
              <input 
                type="password" 
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="****"
                autoFocus
                style={{ 
                  width: '100%', 
                  padding: '1rem', 
                  marginBottom: '1.5rem', 
                  background: 'var(--bg-dark)', 
                  color: 'white', 
                  border: '1px solid var(--glass-border)', 
                  borderRadius: '4px',
                  textAlign: 'center',
                  fontSize: '1.5rem',
                  letterSpacing: '5px'
                }} 
              />
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="button" onClick={() => { setShowPinModal(false); setPinInput(''); }} className="btn-modal-cancel">Cancelar</button>
                <button type="submit" className="btn-primary" style={{ padding: '0.8rem', flex: 1 }}>Entrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Delete Confirm Modal */}
      {categoryToDelete !== null && (
        <div className="modal-overlay">
          <div className="glass-card modal-content" style={{ maxWidth: '400px' }}>
            <h3 style={{ marginBottom: '1rem', color: '#ff4d4d' }}>Eliminar Categoria?</h3>
            <p style={{ marginBottom: '2rem', color: 'var(--text-main)', lineHeight: '1.6' }}>
              Tem a certeza que deseja apagar a categoria <strong>{draftCategories[categoryToDelete]?.name}</strong> e todos os serviços associados? Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setCategoryToDelete(null)} className="btn-modal-cancel">Cancelar</button>
              <button 
                onClick={() => {
                  const newDraft = [...draftCategories];
                  newDraft.splice(categoryToDelete, 1);
                  setDraftCategories(newDraft);
                  setHasUnsavedChanges(true);
                  setCategoryToDelete(null);
                  showToast('Categoria removida do rascunho.', 'success');
                }} 
                style={{ background: '#ff4d4d', color: 'white', border: 'none', padding: '0.8rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', flex: 1 }}
              >Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved Changes Exit Modal */}
      {showUnsavedExitModal && (
        <div className="modal-overlay">
          <div className="glass-card modal-content" style={{ maxWidth: '400px' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Alterações Pendentes!</h3>
            <p style={{ marginBottom: '2rem', color: 'var(--text-main)', lineHeight: '1.6' }}>
              Tem alterações nos preços ou serviços que não foram guardadas. Se sair agora, irá perder todas as modificações.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button 
                onClick={async () => {
                  await setDoc(doc(db, 'config', 'services'), { categories: draftCategories });
                  setHasUnsavedChanges(false);
                  setShowUnsavedExitModal(false);
                  setIsAdmin(false);
                  showToast('Alterações guardadas com sucesso!', 'success');
                }} 
                className="btn-primary" 
                style={{ margin: 0, padding: '1rem' }}
              >Guardar e Sair</button>
              <button 
                onClick={() => {
                  setDraftCategories(categories);
                  setHasUnsavedChanges(false);
                  setShowUnsavedExitModal(false);
                  setIsAdmin(false);
                }} 
                style={{ background: 'transparent', color: '#ff4d4d', border: '1px solid #ff4d4d', padding: '0.8rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >Sair sem Guardar (Reverter)</button>
              <button onClick={() => setShowUnsavedExitModal(false)} className="btn-modal-cancel">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Global Booking Delete Confirmation Modal */}
      {bookingToDelete !== null && (
        <div className="modal-overlay">
          <div className="glass-card modal-content" style={{ maxWidth: '420px' }}>
            <div style={{ width: '60px', height: '60px', background: 'rgba(255, 77, 77, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: '#ff4d4d' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
            </div>
            <h3 style={{ marginBottom: '1rem', color: '#ff4d4d' }}>Eliminar Marcação?</h3>
            <p style={{ marginBottom: '2rem', color: 'var(--text-main)', lineHeight: '1.6' }}>
              Tem a certeza que deseja eliminar esta reserva? Esta ação não pode ser revertida.
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                onClick={() => setBookingToDelete(null)}
                className="btn-modal-cancel"
              >
                Não, manter
              </button>
              <button 
                onClick={executeDelete}
                style={{ background: '#ff4d4d', color: 'white', border: 'none', padding: '1rem', borderRadius: '12px', cursor: 'pointer', fontWeight: '800', flex: 1 }}
              >
                Sim, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
