import { http, HttpResponse } from 'msw';

const mockTodos = [
  { userId: 1, id: 1, title: 'Mock todo 1', completed: false },
  { userId: 1, id: 2, title: 'Mock todo 2', completed: true },
  { userId: 1, id: 3, title: 'Mock todo 3', completed: false },
  { userId: 2, id: 4, title: 'Mock todo 4', completed: true },
  { userId: 2, id: 5, title: 'Mock todo 5', completed: false },
];

const mockPosts = [
  {
    userId: 1,
    id: 1,
    title: 'Mock post title 1',
    body: 'Mock post body 1',
  },
  {
    userId: 1,
    id: 2,
    title: 'Mock post title 2',
    body: 'Mock post body 2',
  },
];

const mockUsers = [
  {
    id: 1,
    name: 'Mock User 1',
    username: 'mockuser1',
    email: 'mock1@example.com',
  },
  {
    id: 2,
    name: 'Mock User 2',
    username: 'mockuser2',
    email: 'mock2@example.com',
  },
];

export const jsonplaceholderHandlers = [
  http.get('https://jsonplaceholder.typicode.com/todos', () => {
    return HttpResponse.json(mockTodos);
  }),

  http.get('https://jsonplaceholder.typicode.com/todos/:id', ({ params }) => {
    const todo = mockTodos.find((t) => t.id === Number(params['id']));
    if (todo) {
      return HttpResponse.json(todo);
    }
    return new HttpResponse(null, { status: 404 });
  }),

  http.get('https://jsonplaceholder.typicode.com/posts', () => {
    return HttpResponse.json(mockPosts);
  }),

  http.get('https://jsonplaceholder.typicode.com/posts/:id', ({ params }) => {
    const post = mockPosts.find((p) => p.id === Number(params['id']));
    if (post) {
      return HttpResponse.json(post);
    }
    return new HttpResponse(null, { status: 404 });
  }),

  http.get('https://jsonplaceholder.typicode.com/users', () => {
    return HttpResponse.json(mockUsers);
  }),

  http.get('https://jsonplaceholder.typicode.com/users/:id', ({ params }) => {
    const user = mockUsers.find((u) => u.id === Number(params['id']));
    if (user) {
      return HttpResponse.json(user);
    }
    return new HttpResponse(null, { status: 404 });
  }),
];
