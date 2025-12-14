import { useState } from 'react';
import { udl, gql } from 'universal-data-layer/client';
import { isTodo, type Todo } from './plugins/todo-source/generated';

type QueryType = 'all' | 'byUserId' | 'completed' | 'incomplete';

export default function JSONPlaceholderTodos() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [todos, setTodos] = useState<Todo[]>([]);
  const [queryType, setQueryType] = useState<QueryType>('all');
  const [userId, setUserId] = useState<number>(1);
  const [validationResults, setValidationResults] = useState<string[]>([]);

  const fetchTodosByUserId = async (userId: number): Promise<Todo[]> => {
    const [error, data] = await udl.query<Todo[]>(
      gql`
        query ($userId: Int!) {
          allTodos(filter: { userId: { eq: $userId } }) {
            externalId
            userId
            title
            completed
            internal {
              id
              type
              owner
              contentDigest
            }
          }
        }
      `,
      { variables: { userId } }
    );
    if (error) throw new Error(error.message);
    return data;
  };

  const fetchTodosByCompleted = async (completed: boolean): Promise<Todo[]> => {
    const [error, data] = await udl.query<Todo[]>(
      gql`
        query ($completed: Boolean!) {
          allTodos(filter: { completed: { eq: $completed } }) {
            externalId
            userId
            title
            completed
            internal {
              id
              type
              owner
              contentDigest
            }
          }
        }
      `,
      { variables: { completed } }
    );
    if (error) throw new Error(error.message);
    return data;
  };

  const getAllTodos = async (): Promise<Todo[]> => {
    const [error, data] = await udl.query<Todo[]>(gql`
      {
        allTodos {
          externalId
          userId
          title
          completed
          internal {
            id
            type
            owner
            contentDigest
          }
        }
      }
    `);
    if (error) throw new Error(error.message);
    return data;
  };

  const fetchTodos = async () => {
    setLoading(true);
    setError('');
    setTodos([]);
    setValidationResults([]);

    try {
      let fetchedTodos: Todo[];

      switch (queryType) {
        case 'byUserId':
          fetchedTodos = await fetchTodosByUserId(userId);
          break;
        case 'completed':
          fetchedTodos = await fetchTodosByCompleted(true);
          break;
        case 'incomplete':
          fetchedTodos = await fetchTodosByCompleted(false);
          break;
        default:
          fetchedTodos = await getAllTodos();
      }

      // Validate each todo using the type guard
      const validations = fetchedTodos.map((todo, index) => {
        const isValid = isTodo(todo);
        return `Todo ${index + 1}: ${isValid ? 'Valid' : 'Invalid'}`;
      });

      setTodos(fetchedTodos);
      setValidationResults(validations);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch todos';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl">
      <div className="space-y-6">
        {/* Automatic Codegen Info */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <h4 className="font-semibold text-indigo-900 mb-2">
            Automatic Type Generation
          </h4>
          <p className="text-sm text-indigo-700 mb-3">
            Types, guards, and helpers are{' '}
            <strong>automatically generated</strong> when the server starts.
            Configure in <code>udl.config.ts</code>:
          </p>
          <div className="bg-indigo-900 text-indigo-100 rounded p-3 font-mono text-sm overflow-x-auto whitespace-pre">
            {`codegen: {
  output: './generated',
  guards: true,
  helpers: true,
}`}
          </div>
          <p className="text-xs text-indigo-600 mt-2">
            Generated files: ./generated/types/index.ts,
            ./generated/guards/index.ts, ./generated/helpers/index.ts
          </p>
        </div>

        {/* Query Controls */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Query Options</h4>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Query Type
              </label>
              <select
                value={queryType}
                onChange={(e) => setQueryType(e.target.value as QueryType)}
                className="px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="all">All Todos</option>
                <option value="byUserId">By User ID</option>
                <option value="completed">Completed Only</option>
                <option value="incomplete">Incomplete Only</option>
              </select>
            </div>

            {queryType === 'byUserId' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  User ID
                </label>
                <input
                  type="number"
                  value={userId}
                  onChange={(e) => setUserId(parseInt(e.target.value) || 1)}
                  min={1}
                  max={10}
                  className="px-3 py-2 border border-gray-300 rounded-md w-20"
                />
              </div>
            )}

            <button
              onClick={fetchTodos}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Fetching...' : 'Fetch Todos'}
            </button>
          </div>
        </div>

        {/* What Would Be Generated */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h4 className="font-semibold text-purple-900 mb-2">
            Generated Code Example
          </h4>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-medium text-purple-800 mb-1">types/Todo.ts</p>
              <pre className="bg-white rounded p-2 text-xs overflow-x-auto border border-purple-200">
                {`interface Todo extends Node {
  externalId: number;
  userId: number;
  title: string;
  completed: boolean;
}`}
              </pre>
            </div>
            <div>
              <p className="font-medium text-purple-800 mb-1">guards/Todo.ts</p>
              <pre className="bg-white rounded p-2 text-xs overflow-x-auto border border-purple-200">
                {`function isTodo(value): value is Todo
function assertTodo(value): asserts value is Todo`}
              </pre>
            </div>
            <div>
              <p className="font-medium text-purple-800 mb-1">
                helpers/Todo.ts
              </p>
              <pre className="bg-white rounded p-2 text-xs overflow-x-auto border border-purple-200">
                {`getAllTodos(): Promise<Todo[]>
getTodoById(id): Promise<Todo | null>
getTodosByUserId(userId): Promise<Todo[]>`}
              </pre>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-semibold text-red-900 mb-1">Error</h4>
            <p className="text-red-700 font-mono text-sm">{error}</p>
            <p className="text-red-600 text-sm mt-2">
              Make sure the UDL server is running on port 4000
            </p>
          </div>
        )}

        {/* Validation Results */}
        {validationResults.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-900 mb-2">
              Type Guard Validation
            </h4>
            <p className="text-sm text-green-700 mb-2">
              Using <code>isTodo()</code> to validate each fetched todo:
            </p>
            <div className="text-xs font-mono text-green-800">
              {validationResults.slice(0, 5).join(' | ')}
              {validationResults.length > 5 &&
                ` ... and ${validationResults.length - 5} more`}
            </div>
          </div>
        )}

        {/* Todos Display */}
        {todos.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              Todos ({todos.length} total)
            </h4>

            <div className="space-y-3">
              {todos.map((todo) => (
                <div
                  key={todo.internal.id}
                  className={`border rounded-lg p-4 ${
                    todo.completed
                      ? 'bg-green-50 border-green-200'
                      : 'bg-yellow-50 border-yellow-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`inline-block text-xs font-semibold px-2 py-1 rounded ${
                            todo.completed
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {todo.completed ? 'Completed' : 'Pending'}
                        </span>
                        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded">
                          User {todo.userId}
                        </span>
                      </div>
                      <p
                        className={`text-gray-800 ${todo.completed ? 'line-through text-gray-500' : ''}`}
                      >
                        {todo.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 font-mono">
                        ID: {todo.externalId} | Node: {todo.internal.id}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Statistics */}
        {todos.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">Statistics</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-blue-700 font-medium">Total:</span>{' '}
                <span className="text-blue-900">{todos.length}</span>
              </div>
              <div>
                <span className="text-blue-700 font-medium">Completed:</span>{' '}
                <span className="text-blue-900">
                  {todos.filter((t) => t.completed).length}
                </span>
              </div>
              <div>
                <span className="text-blue-700 font-medium">Pending:</span>{' '}
                <span className="text-blue-900">
                  {todos.filter((t) => !t.completed).length}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
