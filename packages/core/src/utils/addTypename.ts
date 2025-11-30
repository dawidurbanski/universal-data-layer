/**
 * Utility to automatically add __typename to all selection sets in a GraphQL document.
 * This ensures normalization works without requiring users to manually include __typename.
 */

import {
  type DocumentNode,
  type SelectionSetNode,
  type FieldNode,
  Kind,
  visit,
} from 'graphql';

/**
 * The __typename field node to inject
 */
const typenameFieldNode: FieldNode = {
  kind: Kind.FIELD,
  name: {
    kind: Kind.NAME,
    value: '__typename',
  },
};

/**
 * Check if a selection set already has __typename
 */
function hasTypename(selectionSet: SelectionSetNode): boolean {
  return selectionSet.selections.some(
    (selection) =>
      selection.kind === Kind.FIELD && selection.name.value === '__typename'
  );
}

/**
 * Add __typename to a selection set if not already present
 */
function addTypenameToSelectionSet(
  selectionSet: SelectionSetNode
): SelectionSetNode {
  if (hasTypename(selectionSet)) {
    return selectionSet;
  }

  return {
    ...selectionSet,
    selections: [typenameFieldNode, ...selectionSet.selections],
  };
}

/**
 * Adds __typename field to every selection set in a GraphQL document.
 * This enables automatic normalization of responses without requiring
 * users to manually include __typename in their queries.
 *
 * @param document - The parsed GraphQL document
 * @returns A new document with __typename added to all selection sets
 *
 * @example
 * ```graphql
 * # Input query
 * query {
 *   product(id: "123") {
 *     name
 *     variants {
 *       color
 *     }
 *   }
 * }
 *
 * # Output query (after transformation)
 * query {
 *   product(id: "123") {
 *     __typename
 *     name
 *     variants {
 *       __typename
 *       color
 *     }
 *   }
 * }
 * ```
 */
export function addTypenameToDocument(document: DocumentNode): DocumentNode {
  return visit(document, {
    SelectionSet: {
      leave(node: SelectionSetNode): SelectionSetNode {
        return addTypenameToSelectionSet(node);
      },
    },
  });
}
