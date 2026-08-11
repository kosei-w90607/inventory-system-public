#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum JanCodeValidationError {
    InvalidLengthOrCharacters,
    InvalidCheckDigit,
}

impl JanCodeValidationError {
    pub(super) fn message(self) -> &'static str {
        match self {
            Self::InvalidLengthOrCharacters => "JANコードは13桁または8桁で入力してください",
            Self::InvalidCheckDigit => {
                "JANコードのチェックディジットが一致しません。入力値を確認してください"
            }
        }
    }
}

pub(super) fn validate(value: &str) -> Result<(), JanCodeValidationError> {
    if !matches!(value.len(), 8 | 13) || !value.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err(JanCodeValidationError::InvalidLengthOrCharacters);
    }

    let bytes = value.as_bytes();
    let first_weight = if value.len() == 8 { 3 } else { 1 };
    let sum: u32 = bytes[..bytes.len() - 1]
        .iter()
        .enumerate()
        .map(|(index, byte)| {
            let digit = u32::from(*byte - b'0');
            let weight = if index % 2 == 0 {
                first_weight
            } else {
                4 - first_weight
            };
            digit * weight
        })
        .sum();
    let expected_check_digit = (10 - (sum % 10)) % 10;
    let actual_check_digit = u32::from(bytes[bytes.len() - 1] - b'0');

    if expected_check_digit == actual_check_digit {
        Ok(())
    } else {
        Err(JanCodeValidationError::InvalidCheckDigit)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn req101_validates_ean_13_golden_profile_and_rejects_wrong_check_digit() {
        assert_eq!(validate("4901234567887"), Ok(()));
        assert_eq!(
            validate("4901234567890"),
            Err(JanCodeValidationError::InvalidCheckDigit)
        );
    }

    #[test]
    fn req101_validates_ean_8_golden_profile_with_index_zero_weight_three() {
        assert_eq!(validate("96385074"), Ok(()));
        assert_eq!(validate("49123456"), Ok(()));
        assert_eq!(
            validate("49123457"),
            Err(JanCodeValidationError::InvalidCheckDigit)
        );
    }

    #[test]
    fn req101_rejects_non_ascii_and_lengths_other_than_eight_or_thirteen() {
        for value in [
            "1234567",
            "123456789",
            "123456789012",
            "12345678901234",
            "490123456788A",
            "４９０１２３４５６７８８７",
        ] {
            assert_eq!(
                validate(value),
                Err(JanCodeValidationError::InvalidLengthOrCharacters),
                "value={value}"
            );
        }
    }
}
