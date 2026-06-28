import React, { useState, useMemo } from 'react';
import { CalendarEvent } from '../types';
import { 
  CalendarDays, ChevronLeft, ChevronRight, Plus, 
  Trash2, Edit2, X, AlertCircle, Info, Calendar as CalendarIcon
} from 'lucide-react';

interface EduCalendarProps {
  events: CalendarEvent[];
  onUpdateEvents: (events: CalendarEvent[]) => void;
}

const EVENT_TYPES = {
  holiday: { label: 'Hari Libur', color: 'bg-red-100 text-red-700 border-red-200' },
  exam: { label: 'Ujian/Asesmen', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  activity: { label: 'Kegiatan Sekolah', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  meeting: { label: 'Rapat/Pertemuan', color: 'bg-blue-100 text-blue-700 border-blue-200' },
};

export default function EduCalendar({ events, onUpdateEvents }: EduCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  
  // Form states
  const [formData, setFormData] = useState<{
    title: string;
    date: string;
    type: 'holiday' | 'exam' | 'activity' | 'meeting';
    description: string;
  }>({
    title: '',
    date: new Date().toISOString().split('T')[0],
    type: 'activity',
    description: ''
  });

  // Calendar logic
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const currentMonthEvents = useMemo(() => {
    return events.filter(e => {
      const eDate = new Date(e.date);
      return eDate.getMonth() === currentDate.getMonth() && eDate.getFullYear() === currentDate.getFullYear();
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events, currentDate]);

  const openAddModal = (dateStr?: string) => {
    setFormData({
      title: '',
      date: dateStr || new Date().toISOString().split('T')[0],
      type: 'activity',
      description: ''
    });
    setEditingEventId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (event: CalendarEvent) => {
    setFormData({
      title: event.title,
      date: event.date,
      type: event.type,
      description: event.description || ''
    });
    setEditingEventId(event.id);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.date) return;

    if (editingEventId) {
      const updated = events.map(ev => 
        ev.id === editingEventId 
          ? { ...ev, ...formData } 
          : ev
      );
      onUpdateEvents(updated);
    } else {
      const newEvent: CalendarEvent = {
        id: `EVT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        ...formData
      };
      onUpdateEvents([...events, newEvent]);
    }
    
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Yakin ingin menghapus agenda ini?')) {
      onUpdateEvents(events.filter(e => e.id !== id));
    }
  };

  // Generate calendar grid cells
  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(<div key={`empty-${i}`} className="h-24 sm:h-32 bg-gray-50/50 border border-gray-100 rounded-xl"></div>);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const dayEvents = events.filter(e => e.date === dateStr);
    const isToday = dateStr === new Date().toISOString().split('T')[0];

    days.push(
      <div 
        key={i} 
        onClick={() => openAddModal(dateStr)}
        className={`h-24 sm:h-32 border border-gray-100 rounded-xl p-2 relative group hover:border-purple-300 hover:shadow-xs transition-all cursor-pointer flex flex-col ${isToday ? 'bg-purple-50/50 ring-2 ring-purple-500 ring-inset' : 'bg-white'}`}
      >
        <div className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-purple-600 text-white' : 'text-gray-500 group-hover:text-purple-600 group-hover:bg-purple-50'}`}>
          {i}
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 no-scrollbar">
          {dayEvents.map(evt => (
            <div 
              key={evt.id} 
              onClick={(e) => { e.stopPropagation(); openEditModal(evt); }}
              className={`text-[9px] sm:text-[10px] p-1 px-1.5 rounded-md truncate font-semibold border ${EVENT_TYPES[evt.type].color}`}
              title={evt.title}
            >
              {evt.title}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      
      {/* HEADER */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-gray-100 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-purple-600" /> Kalender Pendidikan
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Kelola agenda sekolah, hari libur, dan kegiatan tahunan.
          </p>
        </div>
        <button
          onClick={() => openAddModal()}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm shadow-purple-200 cursor-pointer whitespace-nowrap"
        >
          <Plus className="h-4 w-4" /> Tambah Agenda
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* MAIN CALENDAR GRID */}
        <div className="lg:col-span-3 bg-white border border-gray-100 rounded-3xl p-5 sm:p-6 shadow-xs">
          
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-gray-400" />
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h3>
            <div className="flex items-center gap-2">
              <button 
                onClick={prevMonth}
                className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 text-gray-600 transition-colors cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button 
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold text-gray-600 transition-colors cursor-pointer"
              >
                Hari Ini
              </button>
              <button 
                onClick={nextMonth}
                className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 text-gray-600 transition-colors cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((day, idx) => (
              <div key={day} className={`text-center text-xs font-bold py-2 ${idx === 0 ? 'text-red-500' : 'text-gray-500'}`}>
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {days}
          </div>

          {/* Legend */}
          <div className="mt-6 pt-6 border-t border-gray-100 flex flex-wrap gap-4">
            {Object.entries(EVENT_TYPES).map(([key, config]) => (
              <div key={key} className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                <div className={`w-3 h-3 rounded-full border ${config.color.split(' ')[0]} ${config.color.split(' ')[2]}`}></div>
                {config.label}
              </div>
            ))}
          </div>

        </div>

        {/* SIDEBAR LIST */}
        <div className="lg:col-span-1 bg-white border border-gray-100 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col h-[500px] lg:h-auto">
          <h3 className="text-sm font-black text-gray-900 mb-4 flex items-center gap-2">
            <Info className="h-4 w-4 text-purple-600" /> Agenda Bulan Ini
          </h3>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-4">
            {currentMonthEvents.length === 0 ? (
              <div className="text-center py-10">
                <CalendarDays className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                <p className="text-xs text-gray-400 font-medium">Belum ada agenda di bulan ini.</p>
              </div>
            ) : (
              currentMonthEvents.map(evt => (
                <div 
                  key={evt.id} 
                  onClick={() => openEditModal(evt)}
                  className={`p-3 rounded-xl border cursor-pointer hover:shadow-xs transition-shadow ${EVENT_TYPES[evt.type].color.replace('border-', 'border-')}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="text-xs font-bold truncate pr-2">{evt.title}</h4>
                    <span className="text-[10px] font-bold opacity-80 whitespace-nowrap bg-white/50 px-1.5 py-0.5 rounded-md">
                      {new Date(evt.date).getDate()} {monthNames[new Date(evt.date).getMonth()].substring(0,3)}
                    </span>
                  </div>
                  <p className="text-[10px] opacity-90 line-clamp-2">{evt.description || '-'}</p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* ADD/EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-gray-100 flex flex-col">
            
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="text-lg font-black text-gray-900">
                {editingEventId ? 'Ubah Agenda' : 'Tambah Agenda Baru'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-full transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Judul Agenda <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                  placeholder="Contoh: Ujian Tengah Semester"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Tanggal <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Jenis Agenda <span className="text-red-500">*</span></label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all cursor-pointer appearance-none"
                  >
                    {Object.entries(EVENT_TYPES).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Keterangan Tambahan</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all resize-none"
                  placeholder="Keterangan opsional..."
                />
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                {editingEventId ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingEventId)}
                    className="px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 font-bold rounded-xl text-sm flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" /> Hapus
                  </button>
                ) : (
                  <div className="flex-1"></div>
                )}
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 hover:bg-gray-100 text-gray-600 font-bold rounded-xl text-sm transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-sm transition-colors cursor-pointer shadow-sm shadow-purple-200"
                  >
                    Simpan
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
