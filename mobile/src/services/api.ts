export const API_BASE = "https://barberpro-black.vercel.app";

interface RegisterData {
  ownerName: string;
  shopName: string;
  phone: string;
  password: string;
  openTime: string;
  closeTime: string;
  workDays: number[];
  avgServiceTime: number;
  services: {
    name: string;
    duration: number;
    price: number;
    category: string;
  }[];
}

interface LoginData {
  phone: string;
  password: string;
}

async function request(path: string, options?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    throw new Error(isAbort ? "Tempo esgotado. Verifique sua internet e tente novamente." : "Sem conexão. Verifique sua internet.");
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro na requisição");
  return data;
}

export const api = {
  register: (data: RegisterData) =>
    request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data: LoginData) =>
    request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getAppointments: (token: string, date?: string) => {
    const query = date ? `?date=${date}` : "";
    return request(`/api/me/appointments${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  confirmPayment: (token: string, appointmentId: string, paymentMethod: string, deferredPaymentDate?: string) =>
    request("/api/me/finance", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ appointmentId, paymentMethod, ...(deferredPaymentDate ? { deferredPaymentDate } : {}) }),
    }),

  getFinanceReport: (token: string, start: string, end: string, barberId?: string) => {
    const extra = barberId ? `&barberId=${barberId}` : "";
    return request(`/api/me/finance?start=${start}&end=${end}${extra}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  getLoyalty: (token: string) =>
    request("/api/me/loyalty", {
      headers: { Authorization: `Bearer ${token}` },
    }),

  getDashboard: (token: string) =>
    request("/api/me/dashboard", {
      headers: { Authorization: `Bearer ${token}` },
    }),

  getBarbers: (token: string) =>
    request("/api/auth/add-barber", {
      headers: { Authorization: `Bearer ${token}` },
    }),

  addBarber: (token: string, data: { name: string; phone: string; password: string; role?: "barber" | "owner"; commission?: number }) =>
    request("/api/auth/add-barber", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),

  toggleBarber: (token: string, barberId: string, active: boolean) =>
    request("/api/auth/add-barber", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ barberId, active }),
    }),

  updateBarberRole: (token: string, barberId: string, role: "barber" | "owner") =>
    request("/api/auth/add-barber", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ barberId, role }),
    }),

  updateBarberCommission: (token: string, barberId: string, commission: number) =>
    request("/api/auth/add-barber", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ barberId, commission }),
    }),

  getProducts: (token: string) =>
    request("/api/me/products", {
      headers: { Authorization: `Bearer ${token}` },
    }),

  addProduct: (token: string, data: { name: string; price: number; description?: string; imageUrl?: string; imageUrl2?: string }) =>
    request("/api/me/products", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),

  uploadImage: async (token: string, uri: string, mimeType: string): Promise<string> => {
    const filename = uri.split("/").pop() || `photo_${Date.now()}.jpg`;
    const formData = new FormData();
    formData.append("file", { uri, name: filename, type: mimeType } as unknown as Blob);
    const res = await fetch(`${API_BASE}/api/me/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Falha no upload");
    return data.url as string;
  },

  addComandaItem: (token: string, appointmentId: string, productId: string, quantity: number) =>
    request("/api/me/products", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ appointmentId, productId, quantity }),
    }),

  getBlockedSlots: (token: string, date: string, barberId?: string) => {
    const extra = barberId ? `&barberId=${barberId}` : "";
    return request(`/api/me/blocked-slots?date=${date}${extra}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  blockSlots: (token: string, date: string, times: string[], barberId?: string) =>
    request("/api/me/blocked-slots", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ date, times, ...(barberId ? { barberId } : {}) }),
    }),

  blockAllDay: (token: string, date: string, barberId?: string) =>
    request("/api/me/blocked-slots", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ date, allDay: true, ...(barberId ? { barberId } : {}) }),
    }),

  unblockSlots: (token: string, date: string, times: string[], barberId?: string) =>
    request("/api/me/blocked-slots", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ date, times, ...(barberId ? { barberId } : {}) }),
    }),

  unblockAllDay: (token: string, date: string, barberId?: string) =>
    request("/api/me/blocked-slots", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ date, allDay: true, ...(barberId ? { barberId } : {}) }),
    }),

  getOwnerBarberProfile: (token: string) =>
    request("/api/me/owner-barber", {
      headers: { Authorization: `Bearer ${token}` },
    }),

  createOwnerBarberProfile: (token: string, data: { name: string; phone: string; password: string }) =>
    request("/api/me/owner-barber", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),

  getShop: (token: string) =>
    request("/api/me/shop", {
      headers: { Authorization: `Bearer ${token}` },
    }),

  updateShop: (token: string, data: {
    openTime?: string;
    closeTime?: string;
    workDays?: number[];
    avgServiceTime?: number;
    pixKey?: string;
    colorTheme?: string;
    bookingMode?: string;
  }) =>
    request("/api/me/shop", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),

  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    request("/api/me/password", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  savePushToken: (token: string, pushToken: string) =>
    request("/api/me/push-token", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ token: pushToken }),
    }),

  cancelAppointment: (token: string, appointmentId: string) =>
    request(`/api/appointments/${appointmentId}/cancel`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    }),

  updateProduct: (token: string, id: string, data: { name?: string; price?: number; description?: string }) =>
    request("/api/me/products", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, ...data }),
    }),

  deleteProduct: (token: string, id: string) =>
    request("/api/me/products", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, active: false }),
    }),

  markNoShow: (token: string, appointmentId: string) =>
    request(`/api/appointments/${appointmentId}/no-show`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    }),

  confirmPixPayment: (token: string, appointmentId: string) =>
    request(`/api/appointments/${appointmentId}/confirm-payment`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    }),

  getServices: (token: string) =>
    request("/api/me/services", {
      headers: { Authorization: `Bearer ${token}` },
    }),

  addService: (token: string, data: { name: string; duration: number; price: number; category: string; imageUrl?: string }) =>
    request("/api/me/services", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),

  updateService: (token: string, id: string, data: { name?: string; duration?: number; price?: number; imageUrl?: string; active?: boolean }) =>
    request("/api/me/services", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, ...data }),
    }),

  updateClientNotes: (token: string, clientId: string, notes: string | null) =>
    request(`/api/me/clients/${clientId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ notes }),
    }),

  getClients: (token: string) =>
    request("/api/me/clients", {
      headers: { Authorization: `Bearer ${token}` },
    }),

  getWaitlist: (token: string) =>
    request("/api/me/waitlist", {
      headers: { Authorization: `Bearer ${token}` },
    }),

  removeFromWaitlist: (token: string, id: string) =>
    request(`/api/me/waitlist/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }),
};
