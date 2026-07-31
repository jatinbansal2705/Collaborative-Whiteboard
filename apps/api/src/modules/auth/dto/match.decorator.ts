import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'match', async: false })
export class MatchConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const relatedProperty = this.getRelatedProperty(args);
    if (relatedProperty === undefined) {
      return false;
    }
    const relatedValue = (args.object as Record<string, unknown>)[
      relatedProperty
    ];
    return typeof value === 'string' && value === relatedValue;
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must match ${args.constraints[0] as string}`;
  }

  private getRelatedProperty(args: ValidationArguments): string | undefined {
    const constraints = args.constraints as unknown[];
    const property = constraints[0];
    return typeof property === 'string' ? property : undefined;
  }
}

export function Match(
  property: string,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (object: object, propertyName: string | symbol): void => {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      constraints: [property],
      validator: MatchConstraint,
    });
  };
}
