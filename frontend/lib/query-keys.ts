export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  users: {
    search: (query: string) => ["users", "search", query] as const,
    presence: (userId: number | string) => ["users", "presence", userId] as const,
    blocked: ["users", "blocked"] as const,
  },
  conversations: {
    all: ["conversations"] as const,
    lists: ["conversations", "list"] as const,
    list: (filter: string) => ["conversations", "list", filter] as const,
    detail: (conversationId: string | number) => ["conversations", String(conversationId)] as const,
    requests: ["conversations", "requests"] as const,
    archived: ["conversations", "archived"] as const,
    sharedMedia: (conversationId: string | number) => ["conversations", String(conversationId), "shared-media"] as const,
    sharedFiles: (conversationId: string | number) => ["conversations", String(conversationId), "shared-files"] as const,
  },
  messages: {
    list: (conversationId: string | number) => ["messages", String(conversationId)] as const,
  },
  admin: {
    opsHealth: ["admin", "ops", "health"] as const,
    opsStatus: ["admin", "ops", "status"] as const,
    permissions: {
      all: ["admin", "permissions"] as const,
      list: (page: number, perPage: number, search: string) => ["admin", "permissions", { page, perPage, search }] as const,
      options: ["admin", "permissions", "options"] as const,
    },
    roles: {
      all: ["admin", "roles"] as const,
      list: (page: number, perPage: number, search: string) => ["admin", "roles", { page, perPage, search }] as const,
      options: ["admin", "roles", "options"] as const,
    },
    users: {
      all: ["admin", "users"] as const,
      list: (page: number, perPage: number, search: string) => ["admin", "users", { page, perPage, search }] as const,
    },
    productUnits: {
      all: ["admin", "product-units"] as const,
      list: (page: number, perPage: number, search: string) => ["admin", "product-units", { page, perPage, search }] as const,
      options: ["admin", "product-units", "options"] as const,
    },
    products: {
      all: ["admin", "products"] as const,
      list: (page: number, perPage: number, search: string) => ["admin", "products", { page, perPage, search }] as const,
      options: ["admin", "products", "options"] as const,
    },
    productPrices: {
      all: ["admin", "product-prices"] as const,
      list: (page: number, perPage: number, search: string) => ["admin", "product-prices", { page, perPage, search }] as const,
      activeOptions: ["admin", "product-prices", "active-options"] as const,
    },
    customers: {
      all: ["admin", "customers"] as const,
      list: (page: number, perPage: number, search: string) => ["admin", "customers", { page, perPage, search }] as const,
      options: ["admin", "customers", "options"] as const,
    },
    systemLogs: {
      all: ["admin", "system-logs"] as const,
      list: (page: number, perPage: number, search: string) => ["admin", "system-logs", { page, perPage, search }] as const,
    },
  },
};
