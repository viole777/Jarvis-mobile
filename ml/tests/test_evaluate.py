import unittest

from ml.evaluate import parse_json_object


class ParseModelOutputTests(unittest.TestCase):
    def test_plain_json(self):
        self.assertEqual(parse_json_object('{"action":"tool_call","tool":"back","arguments":{}}'),
                         {"action": "tool_call", "tool": "back", "arguments": {}})

    def test_json_after_reasoning_prefix(self):
        self.assertEqual(parse_json_object('<think>Need go back.</think> {"action":"tool_call","tool":"back","arguments":{}}'),
                         {"action": "tool_call", "tool": "back", "arguments": {}})

    def test_invalid_output(self):
        self.assertIsNone(parse_json_object("I think the answer is back, but no JSON."))

    def test_ignores_invalid_brace_block(self):
        self.assertEqual(parse_json_object('prefix {not json} then {"action":"final","text":"Olá"}'),
                         {"action": "final", "text": "Olá"})


if __name__ == "__main__":
    unittest.main()
