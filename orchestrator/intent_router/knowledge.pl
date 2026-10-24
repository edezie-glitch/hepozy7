% /orchestrator/intent_router/knowledge.pl
%
% output_type(X) rules, given asserted intent(Intent) and multi_step(Bool) facts.
% router_bridge.py asserts these facts before querying output_type(X).
%
% NOTE (flagged, not silently built): this is a 4-input decision table
% (4 intent values x 2 multi_step values = 8 cells). It's implemented here
% in Prolog per the doc's spec, but nothing about this logic requires
% Prolog specifically — the equivalent is a 5-line Python dict with no
% added runtime, no Python<->Prolog bridge, and no SWI-Prolog install
% dependency. Kept as Prolog here only because it was explicitly requested
% as-is from the doc, not because a case for it was ever made.

output_type(instructions) :-
    intent(how_to),
    multi_step(true).

output_type(reply) :-
    intent(how_to),
    multi_step(false).

output_type(examples) :-
    intent(show_examples).

output_type(reply) :-
    intent(opinion_request).

output_type(workflow) :-
    intent(factual_question),
    multi_step(true).

output_type(reply) :-
    intent(factual_question),
    multi_step(false).
