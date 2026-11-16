import { FormControl } from '@angular/forms';
import { optionalPhone } from './phone.validators';

const control = (value: string) => new FormControl(value);

describe('optionalPhone', () => {
  it.each(['', '   ', '70000000', '+59170000000', '1234567', '123456789012345', ' 70000000 '])(
    'accepts "%s"',
    (value) => expect(optionalPhone(control(value))).toBeNull(),
  );

  it.each(['0123456', '123456', '1234567890123456', '+591 70000000', '7000-0000', 'abc1234'])(
    'rejects "%s"',
    (value) => expect(optionalPhone(control(value))).toEqual({ phone: true }),
  );
});
