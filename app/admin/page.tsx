"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface Document {
  id: number;
  original_name: string;
  file_type: string;
  file_size: number;
  is_active: boolean;
  created_at: string;
  category_id?: number;
  category_name?: string;
  subtopic_ids?: number[];
  subtopic_names?: string[];
}

interface Subtopic {
  id: number;
  category_id: number;
  name: string;
  created_at: string;
}

interface Category {
  id: number;
  name: string;
  created_at: string;
  subtopics: Subtopic[];
}

type TabType = "documents" | "categories" | "statistics";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabType>("documents");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [viewHtml, setViewHtml] = useState<string | null>(null);
  const [viewTitle, setViewTitle] = useState("");
  const [statistics, setStatistics] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingSubtopic, setEditingSubtopic] = useState<number | null>(null);
  const [editingSubtopicName, setEditingSubtopicName] = useState("");
  const [addingSubtopicTo, setAddingSubtopicTo] = useState<number | null>(null);
  const [newSubtopicName, setNewSubtopicName] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedSubtopicIds, setSelectedSubtopicIds] = useState<number[]>([]);
  const [categoriesForUpload, setCategoriesForUpload] = useState<Category[]>([]);
  const [usageStats, setUsageStats] = useState<any>(null);
  const [statsSubTab, setStatsSubTab] = useState<'categories' | 'messages' | 'unanswered'>('categories');
  const [categoryStats, setCategoryStats] = useState<any[]>([]);
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [unansweredQuestions, setUnansweredQuestions] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
    fetchDocuments();
    if (activeTab === "statistics") {
      fetchStatistics();
      fetchUsageStats();
    }
    if (activeTab === "categories") {
      fetchCategories();
    }
    if (activeTab === "documents") {
      fetchCategoriesForUpload();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "statistics") {
      fetchUsageStats();
      fetchCategoryStats();
      if (statsSubTab === 'messages') {
        fetchRecentMessages();
      }
      if (statsSubTab === 'unanswered') {
        fetchUnansweredQuestions();
      }
    }
  }, [statsSubTab, activeTab]);

  const fetchCategoryStats = async () => {
    try {
      const res = await fetch('/api/categories');
      const cats = await res.json();
      const docsRes = await fetch('/api/documents');
      const docs = await docsRes.json();
      const messagesRes = await fetch('/api/messages?limit=1000');
      const messages = await messagesRes.json();

      const documentUsageCount: Record<number, number> = {};
      messages.forEach((msg: any) => {
        if (msg.documentIds && Array.isArray(msg.documentIds)) {
          msg.documentIds.forEach((docId: number) => {
            documentUsageCount[docId] = (documentUsageCount[docId] || 0) + 1;
          });
        }
      });

      const stats = cats.map((cat: Category) => {
        const categoryDocs = docs.filter((d: Document) => d.category_id === cat.id);
        const totalCount = categoryDocs.reduce((sum: number, doc: Document) => sum + (documentUsageCount[doc.id] || 0), 0);

        const subtopicStats = cat.subtopics.map((subtopic: Subtopic) => {
          const subtopicDocs = docs.filter((d: Document) => 
            d.category_id === cat.id && d.subtopic_ids && d.subtopic_ids.includes(subtopic.id)
          );
          const subtopicCount = subtopicDocs.reduce((sum: number, doc: Document) => sum + (documentUsageCount[doc.id] || 0), 0);
          return {
            id: subtopic.id,
            name: subtopic.name,
            count: subtopicCount
          };
        });

        return {
          id: cat.id,
          name: cat.name,
          totalCount,
          subtopics: subtopicStats
        };
      }).sort((a: { totalCount: number }, b: { totalCount: number }) => b.totalCount - a.totalCount);

      setCategoryStats(stats);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchRecentMessages = async () => {
    try {
      const res = await fetch('/api/messages?limit=20');
      const data = await res.json();
      setRecentMessages(data);
    } catch (error) {
      console.error(error);
    }
  };

  const clearMessages = async () => {
    if (!confirm('Удалить все сообщения? Это действие нельзя отменить.')) return;
    try {
      const res = await fetch('/api/messages/clear', { method: 'DELETE' });
      if (res.ok) {
        setRecentMessages([]);
        fetchCategoryStats();
        alert('Все сообщения удалены');
      } else {
        alert('Ошибка удаления сообщений');
      }
    } catch (error) {
      console.error(error);
      alert('Ошибка удаления сообщений');
    }
  };

  const fetchCategoriesForUpload = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategoriesForUpload(data);
    } catch (error) {
      console.error(error);
    }
  };

  const checkAuth = async () => {
    const res = await fetch("/api/auth/check");
    const data = await res.json();
    if (!data.authenticated) {
      router.push("/login");
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      setDocuments(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const res = await fetch("/api/documents");
      const docs = await res.json();
      
      const statsRes = await fetch("/api/statistics");
      const stats = statsRes.ok ? await statsRes.json() : null;
      
      const totalDocs = docs.length;
      const activeDocs = docs.filter((d: Document) => d.is_active).length;
      const totalSize = docs.reduce((sum: number, d: Document) => sum + d.file_size, 0);
      
      setStatistics({
        totalDocuments: totalDocs,
        activeDocuments: activeDocs,
        inactiveDocuments: totalDocs - activeDocs,
        totalSize: totalSize,
        chunks: stats?.chunks || 0,
        images: stats?.images || 0,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const fetchUsageStats = async () => {
    try {
      const res = await fetch('/api/usage-stats');
      const data = await res.json();
      setUsageStats(data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchUnansweredQuestions = async () => {
    try {
      const res = await fetch('/api/unanswered-questions?limit=100');
      const data = await res.json();
      setUnansweredQuestions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchCategories = async () => {
    try {
      const url = categorySearch 
        ? `/api/categories?search=${encodeURIComponent(categorySearch)}`
        : '/api/categories';
      const res = await fetch(url);
      const data = await res.json();
      setCategories(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (activeTab === "categories") {
      fetchCategories();
    }
  }, [categorySearch, activeTab]);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;

    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName }),
      });

      if (res.ok) {
        setNewCategoryName("");
        fetchCategories();
        fetchCategoriesForUpload();
      } else {
        const data = await res.json();
        alert(data.error || "Ошибка создания категории");
      }
    } catch {
      alert("Ошибка создания категории");
    }
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category.id);
    setEditingCategoryName(category.name);
  };

  const handleSaveCategory = async (id: number) => {
    if (!editingCategoryName.trim()) return;

    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingCategoryName }),
      });

      if (res.ok) {
        setEditingCategory(null);
        setEditingCategoryName("");
        fetchCategories();
        fetchCategoriesForUpload();
      } else {
        const data = await res.json();
        alert(data.error || "Ошибка обновления категории");
      }
    } catch {
      alert("Ошибка обновления категории");
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm("Удалить эту категорию? Все подтемы также будут удалены.")) return;

    try {
      await fetch(`/api/categories/${id}`, { method: "DELETE" });
      fetchCategories();
      fetchCategoriesForUpload();
    } catch {
      alert("Ошибка удаления категории");
    }
  };

  const handleAddSubtopic = async (categoryId: number) => {
    if (!newSubtopicName.trim()) return;

    try {
      const res = await fetch("/api/subtopics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: categoryId, name: newSubtopicName }),
      });

      if (res.ok) {
        setNewSubtopicName("");
        setAddingSubtopicTo(null);
        fetchCategories();
        fetchCategoriesForUpload();
      } else {
        const data = await res.json();
        alert(data.error || "Ошибка создания подтемы");
      }
    } catch {
      alert("Ошибка создания подтемы");
    }
  };

  const handleEditSubtopic = (subtopic: Subtopic) => {
    setEditingSubtopic(subtopic.id);
    setEditingSubtopicName(subtopic.name);
  };

  const handleSaveSubtopic = async (id: number) => {
    if (!editingSubtopicName.trim()) return;

    try {
      const res = await fetch(`/api/subtopics/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingSubtopicName }),
      });

      if (res.ok) {
        setEditingSubtopic(null);
        setEditingSubtopicName("");
        fetchCategories();
        fetchCategoriesForUpload();
      } else {
        const data = await res.json();
        alert(data.error || "Ошибка обновления подтемы");
      }
    } catch {
      alert("Ошибка обновления подтемы");
    }
  };

  const handleDeleteSubtopic = async (id: number) => {
    if (!confirm("Удалить эту подтему?")) return;

    try {
      await fetch(`/api/subtopics/${id}`, { method: "DELETE" });
      fetchCategories();
      fetchCategoriesForUpload();
    } catch {
      alert("Ошибка удаления подтемы");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (limit to 4MB for most platforms, can be adjusted)
      const maxSize = 4 * 1024 * 1024; // 4MB
      if (file.size > maxSize) {
        alert(`Файл слишком большой. Максимальный размер: ${(maxSize / 1024 / 1024).toFixed(0)}MB. Размер вашего файла: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        e.target.value = '';
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    if (!selectedCategoryId) {
      alert("Выберите категорию");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("category_id", selectedCategoryId.toString());
    formData.append("subtopic_ids", JSON.stringify(selectedSubtopicIds));

    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        fetchDocuments();
        setSelectedFile(null);
        setSelectedCategoryId(null);
        setSelectedSubtopicIds([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } else {
        let errorMessage = "Ошибка загрузки файла";
        if (res.status === 413) {
          errorMessage = "Файл слишком большой. Максимальный размер файла ограничен настройками сервера (обычно 1-4.5MB). Попробуйте загрузить файл меньшего размера.";
        } else {
          try {
            const data = await res.json();
            errorMessage = data.error || errorMessage;
          } catch {
            // If response is not JSON, use default message
          }
        }
        alert(errorMessage);
      }
    } catch {
      alert("Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  };

  const handleView = async (id: number, name: string) => {
    try {
      const res = await fetch(`/api/documents/${id}`);
      const data = await res.json();
      setViewHtml(data.content_html || `<pre>${data.content}</pre>`);
      setViewTitle(name);
    } catch {
      alert("Ошибка загрузки содержимого");
    }
  };

  const handleToggle = async (id: number, currentState: boolean) => {
    try {
      await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !currentState }),
      });
      fetchDocuments();
    } catch {
      alert("Ошибка изменения статуса");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить этот документ?")) return;

    try {
      await fetch(`/api/documents/${id}`, { method: "DELETE" });
      fetchDocuments();
    } catch {
      alert("Ошибка удаления");
    }
  };

  const handleDownload = async (id: number, name: string) => {
    try {
      const res = await fetch(`/api/documents/${id}`);
      const data = await res.json();
      const blob = new Blob([data.content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name.replace(/\.[^/.]+$/, ".txt");
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Ошибка скачивания");
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ru-RU") + " " + date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="min-h-screen">
      <header className="police-gradient py-3 sm:py-4 px-3 sm:px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <img
              src="/assets/images/download.png"
              alt="Scroll"
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover flex-shrink-0 gold-border"
            />
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-white truncate">Scroll</h1>
              <p className="text-yellow-400 text-xs sm:text-sm truncate">Управление документами</p>
            </div>
          </div>
          <div className="flex gap-2 sm:gap-3 flex-shrink-0">
            <button onClick={() => router.push("/")} className="px-2 sm:px-4 py-1.5 sm:py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors text-xs sm:text-sm whitespace-nowrap">
              <span className="hidden sm:inline">На сайт</span>
              <span className="sm:hidden">Сайт</span>
            </button>
            <button onClick={handleLogout} className="px-2 sm:px-4 py-1.5 sm:py-2 bg-red-500/80 text-white rounded-lg hover:bg-red-600 transition-colors text-xs sm:text-sm whitespace-nowrap">
              Выход
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
        <div className="mb-4 sm:mb-6 border-b border-gray-200 overflow-x-auto">
          <nav className="flex gap-1 min-w-max sm:min-w-0">
            <button
              onClick={() => setActiveTab("documents")}
              className={`px-3 sm:px-6 py-2 sm:py-3 font-medium transition-colors text-sm sm:text-base whitespace-nowrap ${
                activeTab === "documents"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Документы
            </button>
            <button
              onClick={() => setActiveTab("categories")}
              className={`px-3 sm:px-6 py-2 sm:py-3 font-medium transition-colors text-sm sm:text-base whitespace-nowrap ${
                activeTab === "categories"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Категории
            </button>
            <button
              onClick={() => setActiveTab("statistics")}
              className={`px-3 sm:px-6 py-2 sm:py-3 font-medium transition-colors text-sm sm:text-base whitespace-nowrap ${
                activeTab === "statistics"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Статистика
            </button>
          </nav>
        </div>

        {activeTab === "documents" && (
          <>
            <div className="admin-card p-4 sm:p-6 mb-4 sm:mb-6">
              <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">Загрузить файл</h2>
              <div className="flex flex-col gap-3 sm:gap-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
                  <label className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 border-2 border-dashed border-blue-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-sm sm:text-base text-gray-600">Выберите файл</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".docx,.txt,.xlsx,.xls"
                      onChange={handleFileSelect}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                  {selectedFile && (
                    <span className="text-xs sm:text-sm text-gray-600 break-words">
                      Выбран: <span className="font-medium">{selectedFile.name}</span> ({(selectedFile.size / 1024).toFixed(2)} KB)
                    </span>
                  )}
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Категория <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedCategoryId || ""}
                      onChange={(e) => {
                        const catId = e.target.value ? parseInt(e.target.value) : null;
                        setSelectedCategoryId(catId);
                        setSelectedSubtopicIds([]);
                      }}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                      disabled={uploading}
                    >
                      <option value="">Выберите категорию</option>
                      {categoriesForUpload.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedCategoryId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Подтемы (можно выбрать несколько)
                      </label>
                      <div className="flex flex-wrap gap-2 p-3 border-2 border-gray-200 rounded-lg min-h-[60px]">
                        {categoriesForUpload
                          .find(c => c.id === selectedCategoryId)
                          ?.subtopics.map((subtopic) => (
                            <label
                              key={subtopic.id}
                              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={selectedSubtopicIds.includes(subtopic.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedSubtopicIds([...selectedSubtopicIds, subtopic.id]);
                                  } else {
                                    setSelectedSubtopicIds(selectedSubtopicIds.filter(id => id !== subtopic.id));
                                  }
                                }}
                                className="rounded"
                              />
                              <span className="text-sm text-gray-700">{subtopic.name}</span>
                            </label>
                          ))}
                        {categoriesForUpload.find(c => c.id === selectedCategoryId)?.subtopics.length === 0 && (
                          <span className="text-sm text-gray-400">В этой категории пока нет подтем</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || !selectedCategoryId || uploading}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-700 hover:to-blue-800 transition-all"
                >
                  {uploading ? "Загрузка..." : "Загрузить"}
                </button>
                <span className="text-sm text-gray-500">Поддерживаемые форматы: Word (DOCX), TXT, Excel (XLSX)</span>
              </div>
            </div>

            <div className="admin-card overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Имя файла</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Категория</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Подтема</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Тип</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Размер</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Статус</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Создан</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                        Загрузка...
                      </td>
                    </tr>
                  ) : documents.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                        Нет загруженных документов
                      </td>
                    </tr>
                  ) : (
                    documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">{doc.id}</td>
                        <td className="px-4 py-3 text-sm text-gray-800 font-medium">{doc.original_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{doc.category_name || "-"}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {doc.subtopic_names && doc.subtopic_names.length > 0 
                            ? doc.subtopic_names.join(", ")
                            : "-"
                          }
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{doc.file_type}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatSize(doc.file_size)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${doc.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                            {doc.is_active ? "Активен" : "Неактивен"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(doc.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleView(doc.id, doc.original_name)}
                              className="px-3 py-1 bg-teal-500 text-white text-xs rounded hover:bg-teal-600 transition-colors"
                            >
                              Просмотр
                            </button>
                            <button
                              onClick={() => handleDownload(doc.id, doc.original_name)}
                              className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors"
                            >
                              Скачать
                            </button>
                            <button
                              onClick={() => handleToggle(doc.id, doc.is_active)}
                              className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                            >
                              {doc.is_active ? "Деактивировать" : "Активировать"}
                            </button>
                            <button
                              onClick={() => handleDelete(doc.id)}
                              className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
                            >
                              Удалить
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === "categories" && (
          <div className="space-y-6">
            <div className="admin-card p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">Категории</h2>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Поиск категорий..."
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  className="flex-1 px-3 sm:px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm sm:text-base"
                />
                <input
                  type="text"
                  placeholder="Новая категория"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                  className="flex-1 px-3 sm:px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm sm:text-base"
                />
                <button
                  onClick={handleAddCategory}
                  className="px-4 sm:px-6 py-2 bg-teal-500 text-white rounded-lg font-semibold hover:bg-teal-600 transition-colors text-sm sm:text-base whitespace-nowrap"
                >
                  Добавить
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {categories.map((category) => (
                <div key={category.id} className="admin-card overflow-hidden">
                  <div className="bg-teal-500 text-white px-4 py-3 flex justify-between items-center">
                    {editingCategory === category.id ? (
                      <input
                        type="text"
                        value={editingCategoryName}
                        onChange={(e) => setEditingCategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveCategory(category.id);
                          if (e.key === "Escape") {
                            setEditingCategory(null);
                            setEditingCategoryName("");
                          }
                        }}
                        className="flex-1 px-2 py-1 text-white bg-white/20 rounded border border-white/30 focus:outline-none focus:bg-white/30"
                        autoFocus
                      />
                    ) : (
                      <h3 className="font-semibold">{category.name}</h3>
                    )}
                    <div className="flex gap-2">
                      {editingCategory === category.id ? (
                        <>
                          <button
                            onClick={() => handleSaveCategory(category.id)}
                            className="text-xs px-2 py-1 bg-white/20 hover:bg-white/30 rounded transition-colors"
                          >
                            Сохранить
                          </button>
                          <button
                            onClick={() => {
                              setEditingCategory(null);
                              setEditingCategoryName("");
                            }}
                            className="text-xs px-2 py-1 bg-white/20 hover:bg-white/30 rounded transition-colors"
                          >
                            Отмена
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEditCategory(category)}
                            className="text-xs px-2 py-1 bg-white/20 hover:bg-white/30 rounded transition-colors"
                          >
                            Изменить
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(category.id)}
                            className="text-xs px-2 py-1 bg-white/20 hover:bg-white/30 rounded transition-colors"
                          >
                            Удалить
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    {category.subtopics.map((subtopic) => (
                      <div key={subtopic.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                        {editingSubtopic === subtopic.id ? (
                          <>
                            <input
                              type="text"
                              value={editingSubtopicName}
                              onChange={(e) => setEditingSubtopicName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveSubtopic(subtopic.id);
                                if (e.key === "Escape") {
                                  setEditingSubtopic(null);
                                  setEditingSubtopicName("");
                                }
                              }}
                              className="flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveSubtopic(subtopic.id)}
                              className="text-gray-600 hover:text-blue-600"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button
                              onClick={() => {
                                setEditingSubtopic(null);
                                setEditingSubtopicName("");
                              }}
                              className="text-gray-600 hover:text-red-600"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-sm text-gray-700">{subtopic.name}</span>
                            <button
                              onClick={() => handleEditSubtopic(subtopic)}
                              className="text-gray-400 hover:text-blue-600"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteSubtopic(subtopic.id)}
                              className="text-gray-400 hover:text-red-600"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                    {addingSubtopicTo === category.id ? (
                      <div className="flex items-center gap-2 border-2 border-dashed border-gray-300 rounded-lg px-3 py-2">
                        <input
                          type="text"
                          placeholder="Название подтемы"
                          value={newSubtopicName}
                          onChange={(e) => setNewSubtopicName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddSubtopic(category.id);
                            if (e.key === "Escape") {
                              setAddingSubtopicTo(null);
                              setNewSubtopicName("");
                            }
                          }}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleAddSubtopic(category.id)}
                          className="text-gray-600 hover:text-blue-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            setAddingSubtopicTo(null);
                            setNewSubtopicName("");
                          }}
                          className="text-gray-600 hover:text-red-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingSubtopicTo(category.id)}
                        className="w-full border-2 border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                      >
                        + Подтема
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "statistics" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              <div className="admin-card p-4 sm:p-6">
                <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-2">СЕССИЙ</h3>
                <p className="text-2xl sm:text-3xl font-bold text-gray-800">{usageStats?.sessions || 0}</p>
              </div>
              <div className="admin-card p-4 sm:p-6">
                <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-2">ПОЛЬЗОВАТЕЛЕЙ</h3>
                <p className="text-2xl sm:text-3xl font-bold text-gray-800">{usageStats?.uniqueUsers || 0}</p>
              </div>
              <div className="admin-card p-4 sm:p-6">
                <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-2">СООБЩЕНИЙ</h3>
                <p className="text-2xl sm:text-3xl font-bold text-gray-800">{usageStats?.messages || 0}</p>
              </div>
            </div>

            <div className="mt-6 sm:mt-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <div className="admin-card p-4 sm:p-6">
                  <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-2">Всего документов</h3>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-800">{statistics?.totalDocuments || documents.length}</p>
                </div>
              <div className="admin-card p-4 sm:p-6">
                <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-2">Активных документов</h3>
                <p className="text-2xl sm:text-3xl font-bold text-green-600">{statistics?.activeDocuments || documents.filter(d => d.is_active).length}</p>
              </div>
              <div className="admin-card p-4 sm:p-6">
                <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-2">Неактивных документов</h3>
                <p className="text-2xl sm:text-3xl font-bold text-gray-600">{statistics?.inactiveDocuments || documents.filter(d => !d.is_active).length}</p>
              </div>
                <div className="admin-card p-4 sm:p-6">
                  <h3 className="text-xs sm:text-sm font-medium text-gray-500 mb-2">Общий размер</h3>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-800">
                    {statistics ? formatSize(statistics.totalSize) : formatSize(documents.reduce((sum, d) => sum + d.file_size, 0))}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-500 mb-3 sm:mb-4">Статистика по языкам</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {usageStats?.languages && usageStats.languages.length > 0 ? (
                  usageStats.languages.map((lang: any, index: number) => (
                    <div key={index} className="admin-card p-4 sm:p-6">
                      <h4 className="text-xs sm:text-sm font-medium text-gray-500 mb-2">{lang.language}</h4>
                      <p className="text-xl sm:text-2xl font-bold text-gray-800">{lang.count} сообщений</p>
                    </div>
                  ))
                ) : (
                  <div className="admin-card p-4 sm:p-6">
                    <p className="text-gray-600 text-sm sm:text-base">Нет данных</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-500 mb-4">Активность за последние 30 дней</h3>
              <div className="admin-card p-6">
                {usageStats?.activity && usageStats.activity.length > 0 ? (
                  <div className="h-48 sm:h-64 lg:h-80 relative">
                    <svg className="w-full h-full" viewBox="0 0 800 220" preserveAspectRatio="none">
                      {/* Фон сетки */}
                      <defs>
                        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
                        </linearGradient>
                      </defs>
                      
                      {/* Горизонтальные линии сетки */}
                      {[0, 25, 50, 75, 100].map((y) => (
                        <line
                          key={y}
                          x1="40"
                          y1={160 - (y * 1.4)}
                          x2="760"
                          y2={160 - (y * 1.4)}
                          stroke="#e5e7eb"
                          strokeWidth="1"
                          strokeDasharray="2,2"
                        />
                      ))}
                      
                      {/* Данные для графика */}
                      {(() => {
                        const maxCount = Math.max(...usageStats.activity.map((a: any) => a.count), 1);
                        const padding = 40;
                        const width = 720;
                        const height = 160;
                        const stepX = width / Math.max(usageStats.activity.length - 1, 1);
                        
                        const points = usageStats.activity.map((item: any, index: number) => {
                          const x = padding + index * stepX;
                          const y = height - (item.count / maxCount) * height;
                          return `${x},${y}`;
                        }).join(' ');
                        
                        const areaPath = usageStats.activity.map((item: any, index: number) => {
                          const x = padding + index * stepX;
                          const y = height - (item.count / maxCount) * height;
                          return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                        }).join(' ') + ` L ${padding + (usageStats.activity.length - 1) * stepX} ${height} L ${padding} ${height} Z`;
                        
                        return (
                          <>
                            {/* Заливка под линией */}
                            <path
                              d={areaPath}
                              fill="url(#lineGradient)"
                            />
                            
                            {/* Линия графика */}
                            <polyline
                              points={points}
                              fill="none"
                              stroke="#3b82f6"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            
                            {/* Точки на линии */}
                            {usageStats.activity.map((item: any, index: number) => {
                              const x = padding + index * stepX;
                              const y = height - (item.count / maxCount) * height;
                              return (
                                <g key={index}>
                                  <circle
                                    cx={x}
                                    cy={y}
                                    r="4"
                                    fill="#3b82f6"
                                    stroke="#fff"
                                    strokeWidth="2"
                                    className="hover:r-6 transition-all cursor-pointer"
                                  />
                                  <title>{`${new Date(item.date).toLocaleDateString('ru-RU')}: ${item.count} сообщений`}</title>
                                </g>
                              );
                            })}
                            
                            {usageStats.activity.map((item: any, index: number) => {
                              const showEvery = Math.max(1, Math.floor(usageStats.activity.length / 10));
                              if (index % showEvery === 0 || index === usageStats.activity.length - 1) {
                                const x = padding + index * stepX;
                                const date = new Date(item.date);
                                const formattedDate = `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
                                return (
                                  <text
                                    key={index}
                                    x={x}
                                    y={height + 30}
                                    textAnchor="middle"
                                    fontSize="10"
                                    fill="#6b7280"
                                    fontWeight="500"
                                  >
                                    {formattedDate}
                                  </text>
                                );
                              }
                              return null;
                            })}
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">Нет данных за последние 30 дней</p>
                )}
              </div>
            </div>

            <div className="mt-8">
              <div className="flex border-b border-gray-200 mb-6">
                <button
                  onClick={() => {
                    setStatsSubTab('categories');
                    fetchCategoryStats();
                  }}
                  className={`px-6 py-3 text-sm font-medium transition-colors ${
                    statsSubTab === 'categories'
                      ? 'border-b-2 border-teal-500 text-teal-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Популярные категории
                </button>
                <button
                  onClick={() => {
                    setStatsSubTab('messages');
                    fetchRecentMessages();
                    fetchCategoryStats();
                  }}
                  className={`px-6 py-3 text-sm font-medium transition-colors ${
                    statsSubTab === 'messages'
                      ? 'border-b-2 border-teal-500 text-teal-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Последние сообщения
                </button>
                <button
                  onClick={() => {
                    setStatsSubTab('unanswered');
                    fetchUnansweredQuestions();
                  }}
                  className={`px-6 py-3 text-sm font-medium transition-colors ${
                    statsSubTab === 'unanswered'
                      ? 'border-b-2 border-teal-500 text-teal-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Вопросы без ответа
                </button>
              </div>

              {statsSubTab === 'categories' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {categoryStats.map((cat: any) => (
                    <div key={cat.id} className="admin-card p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-base font-semibold text-gray-800">{cat.name}</h4>
                        <span className="w-8 h-8 rounded-full bg-teal-500 text-white flex items-center justify-center text-sm font-semibold">
                          {cat.totalCount}
                        </span>
                      </div>
                      <div className="border-t border-gray-200 pt-4 space-y-2">
                        {cat.subtopics && cat.subtopics.length > 0 ? (
                          cat.subtopics.map((subtopic: any) => (
                            <div key={subtopic.id} className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">{subtopic.name}</span>
                              <span className="text-gray-800 font-medium">{subtopic.count}</span>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-400">Нет подтем</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {categoryStats.length === 0 && (
                    <div className="col-span-full text-center py-8 text-gray-500">
                      Нет категорий
                    </div>
                  )}
                </div>
              )}

              {statsSubTab === 'messages' && (
                <div className="space-y-4">
                  {recentMessages.length > 0 ? (
                    recentMessages.map((msg: any) => (
                      <div key={msg.id} className="admin-card p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs text-gray-500">
                            {msg.language === 'ru'
                              ? 'Русский'
                              : msg.language === 'kz'
                              ? 'Казахский'
                              : msg.language === 'en'
                              ? 'Английский'
                              : msg.language}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(msg.createdAt).toLocaleString('ru-RU', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <div className="mb-3">
                          <p className="text-xs font-medium text-gray-500 mb-1">Вопрос:</p>
                          <p className="text-sm text-gray-800">{msg.question || 'Вопрос отсутствует'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Ответ:</p>
                          <p className="text-sm text-gray-700">{msg.answer || 'Ответ отсутствует'}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="admin-card p-6">
                      <p className="text-gray-500 text-center py-8">Нет сообщений</p>
                    </div>
                  )}
                </div>
              )}

              {statsSubTab === 'unanswered' && (
                <div className="space-y-4">
                  {unansweredQuestions.length > 0 ? (
                    unansweredQuestions.map((q: any) => (
                      <div key={q.id} className="admin-card p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-gray-500">
                            {q.language === 'ru'
                              ? 'Русский'
                              : q.language === 'kz'
                              ? 'Казахский'
                              : q.language === 'en'
                              ? 'Английский'
                              : q.language}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(q.createdAt).toLocaleString('ru-RU', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span className="ml-auto text-xs px-2 py-1 rounded-full bg-red-50 text-red-600 border border-red-100">
                            {q.reason === 'no_active_documents'
                              ? 'Нет активных документов'
                              : q.reason === 'error'
                              ? 'Ошибка обработки'
                              : q.reason === 'out_of_scope'
                              ? 'Вопрос вне тематики документов'
                              : q.reason}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Вопрос:</p>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">{q.question}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="admin-card p-6">
                      <p className="text-gray-500 text-center py-8">Нет вопросов без ответа</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {viewHtml !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-lg sm:rounded-xl max-w-5xl w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-3 sm:p-4 border-b flex-shrink-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 truncate pr-2">{viewTitle}</h3>
              <button
                onClick={() => setViewHtml(null)}
                className="text-gray-500 hover:text-gray-700 flex-shrink-0 p-1"
                aria-label="Закрыть"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6">
              <div
                className="prose prose-sm sm:prose-base max-w-none"
                dangerouslySetInnerHTML={{ __html: viewHtml }}
                style={{
                  lineHeight: '1.6',
                }}
              />
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .prose img {
          max-width: 100%;
          height: auto;
          margin: 1rem 0;
        }
        .prose p {
          margin: 0.5rem 0;
        }
        .prose table {
          border-collapse: collapse;
          width: 100%;
          margin: 1rem 0;
        }
        .prose td, .prose th {
          border: 1px solid #ddd;
          padding: 8px;
        }
      `}</style>
    </div>
  );
}
